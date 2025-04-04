import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import {
  MembershipAction,
  MembershipHistory,
} from 'src/memberships/entities/membership_history.entity';
import {
  MembershipUpgrade,
  UpgradeStatus,
} from 'src/memberships/entities/membership_upgrades.entity';
import {
  PointsTransaction,
  PointTransactionStatus,
  PointTransactionType,
} from 'src/points/entities/points_transactions.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import {
  VolumeProcessingStatus,
  VolumeSide,
  WeeklyVolume,
} from 'src/points/entities/weekly_volumes.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { RejectPaymentDto } from '../dto/approval.dto';
import { Payment, PaymentStatus } from '../entities/payment.entity';

@Injectable()
export class FinancePaymentApprovalService {
  private readonly logger = new Logger(FinancePaymentApprovalService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipPlan)
    private readonly membershipPlanRepository: Repository<MembershipPlan>,
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(WeeklyVolume)
    private readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
    @InjectRepository(MembershipUpgrade)
    private readonly membershipUpgradeRepository: Repository<MembershipUpgrade>,
    private readonly dataSource: DataSource,
  ) {}

  async approvePayment(paymentId: number, reviewerId: string) {
    console.log('paymentId', paymentId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['user', 'paymentConfig'],
      });

      if (!payment) {
        throw new NotFoundException(`Pago con ID ${paymentId} no encontrado`);
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException(
          `El pago ya ha sido ${payment.status === PaymentStatus.APPROVED ? 'aprobado' : 'rechazado'}`,
        );
      }

      const reviewer = await this.userRepository.findOne({
        where: { id: reviewerId },
      });

      if (!reviewer) {
        throw new NotFoundException(
          `Revisor con ID ${reviewerId} no encontrado`,
        );
      }

      // Actualizar el pago
      payment.status = PaymentStatus.APPROVED;
      payment.reviewedBy = reviewer;
      payment.reviewedAt = new Date();

      await queryRunner.manager.save(payment);

      // Procesar según el tipo de pago
      switch (payment.paymentConfig.code) {
        case 'MEMBERSHIP_PAYMENT':
          await this.processMembershipPayment(payment, queryRunner);
          break;
        case 'RECONSUMPTION':
          // TODO: Implementar lógica para reconsumo
          this.logger.log(`Aprobación de reconsumo no implementada aún`);
          break;
        case 'PLAN_UPGRADE':
          await this.processPlanUpgradePayment(payment, queryRunner);
          break;
        default:
          this.logger.warn(
            `Tipo de pago desconocido: ${payment.paymentConfig.code}`,
          );
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Pago aprobado correctamente`,
        paymentId: payment.id,
        reviewedBy: {
          id: reviewer.id,
          email: reviewer.email,
        },
        timestamp: payment.reviewedAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al aprobar pago: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectPayment(
    paymentId: number,
    reviewerId: string,
    rejectPaymentDto: RejectPaymentDto,
  ) {
    console.log('rejectPaymentDto', rejectPaymentDto);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['user', 'paymentConfig'],
      });

      if (!payment) {
        throw new NotFoundException(`Pago con ID ${paymentId} no encontrado`);
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException(
          `El pago ya ha sido ${payment.status === PaymentStatus.APPROVED ? 'aprobado' : 'rechazado'}`,
        );
      }

      const reviewer = await this.userRepository.findOne({
        where: { id: reviewerId },
      });

      if (!reviewer) {
        throw new NotFoundException(
          `Revisor con ID ${reviewerId} no encontrado`,
        );
      }

      if (!rejectPaymentDto.rejectionReason) {
        throw new BadRequestException(
          'Se requiere una razón para rechazar el pago',
        );
      }

      // Actualizar el pago
      payment.status = PaymentStatus.REJECTED;
      payment.reviewedBy = reviewer;
      payment.reviewedAt = new Date();
      payment.rejectionReason = rejectPaymentDto.rejectionReason;

      await queryRunner.manager.save(payment);

      // Si es un pago de membresía, actualizar el estado de la membresía a rechazada
      if (
        payment.paymentConfig.code === 'MEMBERSHIP_PAYMENT' &&
        payment.relatedEntityType === 'membership'
      ) {
        const membership = await this.membershipRepository.findOne({
          where: { id: payment.relatedEntityId },
        });

        if (membership && membership.status === MembershipStatus.PENDING) {
          membership.status = MembershipStatus.INACTIVE;
          await queryRunner.manager.save(membership);

          // Registro histórico
          const membershipHistory = this.membershipHistoryRepository.create({
            membership: { id: membership.id },
            action: MembershipAction.STATUS_CHANGED,
            performedBy: reviewer,
            notes: `Membresía inactivada por rechazo de pago: ${rejectPaymentDto.rejectionReason}`,
            changes: {
              previousStatus: MembershipStatus.PENDING,
              newStatus: MembershipStatus.INACTIVE,
            },
          });

          await queryRunner.manager.save(membershipHistory);
        }
      }

      // Si es un pago de actualización de plan, actualizar el estado del upgrade a CANCELLED
      if (
        payment.paymentConfig.code === 'PLAN_UPGRADE' &&
        payment.relatedEntityType === 'membership_upgrade'
      ) {
        const membershipUpgrade =
          await this.membershipUpgradeRepository.findOne({
            where: { id: payment.relatedEntityId },
            relations: ['membership'],
          });

        if (
          membershipUpgrade &&
          membershipUpgrade.status === UpgradeStatus.PENDING
        ) {
          // Actualizar el estado del upgrade a CANCELLED
          membershipUpgrade.status = UpgradeStatus.CANCELLED;
          await queryRunner.manager.save(membershipUpgrade);

          // Registro histórico
          const membershipHistory = this.membershipHistoryRepository.create({
            membership: { id: membershipUpgrade.membership.id },
            action: MembershipAction.STATUS_CHANGED,
            performedBy: reviewer,
            notes: `Actualización de plan cancelada por rechazo de pago: ${rejectPaymentDto.rejectionReason}`,
            changes: {
              previousUpgradeStatus: UpgradeStatus.PENDING,
              newUpgradeStatus: UpgradeStatus.CANCELLED,
              upgradeId: membershipUpgrade.id,
            },
          });

          await queryRunner.manager.save(membershipHistory);
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Pago rechazado correctamente`,
        paymentId: payment.id,
        rejectionReason: payment.rejectionReason,
        reviewedBy: {
          id: reviewer.id,
          email: reviewer.email,
        },
        timestamp: payment.reviewedAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al rechazar pago: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async processMembershipPayment(payment: Payment, queryRunner: any) {
    if (payment.relatedEntityType !== 'membership') {
      throw new BadRequestException(
        'El pago no está relacionado a una membresía',
      );
    }

    const membership = await this.membershipRepository.findOne({
      where: { id: payment.relatedEntityId },
      relations: ['user', 'plan'],
    });

    if (!membership) {
      throw new NotFoundException(
        `Membresía con ID ${payment.relatedEntityId} no encontrada`,
      );
    }

    if (membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException(`La membresía no está en estado pendiente`);
    }

    const user = membership.user;
    const plan = membership.plan;

    // 1. Crear o actualizar UserPoints y asignar los binaryPoints del plan
    const userPoints = await this.userPointsRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (userPoints) {
      userPoints.membershipPlan = plan;
      await queryRunner.manager.save(userPoints);
    } else {
      const newUserPoints = this.userPointsRepository.create({
        user: { id: user.id },
        membershipPlan: plan,
        availablePoints: 0,
        totalEarnedPoints: 0,
        totalWithdrawnPoints: 0,
      });
      await queryRunner.manager.save(newUserPoints);
    }

    // 2. Procesar bonos directos si tiene referente
    if (user.referrerCode) {
      await this.processDirectBonus(user, plan, queryRunner);
    }
    const binaryPoints = plan.binaryPoints;
    await this.updateUserVolume(user, binaryPoints, queryRunner);

    // 3. Alimentar los volúmenes del árbol
    await this.processTreeVolumes(user, plan, queryRunner);

    // 4. Actualizar membresía
    const now = new Date();
    const expirationDate = new Date(now);
    expirationDate.setDate(expirationDate.getDate() + 30);

    const nextReconsumptionDate = new Date(expirationDate);
    nextReconsumptionDate.setDate(nextReconsumptionDate.getDate() + 30);

    membership.status = MembershipStatus.ACTIVE;
    membership.startDate = now;
    membership.endDate = expirationDate;
    membership.nextReconsumptionDate = nextReconsumptionDate;

    await queryRunner.manager.save(membership);

    // 5. Crear registro histórico
    const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.STATUS_CHANGED,
      performedBy: payment.reviewedBy,
      notes: 'Membresía activada por aprobación de pago',
      changes: {
        previousStatus: MembershipStatus.PENDING,
        newStatus: MembershipStatus.ACTIVE,
        startDate: now,
        endDate: expirationDate,
        nextReconsumptionDate: nextReconsumptionDate,
      },
    });

    await queryRunner.manager.save(membershipHistory);
  }

  private async processPlanUpgradePayment(payment: Payment, queryRunner: any) {
    if (payment.relatedEntityType !== 'membership_upgrade') {
      throw new BadRequestException(
        'El pago no está relacionado a una actualización de plan',
      );
    }

    const membershipUpgrade = await this.membershipUpgradeRepository.findOne({
      where: { id: payment.relatedEntityId },
      relations: ['membership', 'fromPlan', 'toPlan', 'membership.user'],
    });

    if (!membershipUpgrade) {
      throw new NotFoundException(
        `Actualización con ID ${payment.relatedEntityId} no encontrada`,
      );
    }

    if (membershipUpgrade.status !== UpgradeStatus.PENDING) {
      throw new BadRequestException(
        `La actualización no está en estado pendiente`,
      );
    }

    const user = membershipUpgrade.membership.user;
    const fromPlan = membershipUpgrade.fromPlan;
    const toPlan = membershipUpgrade.toPlan;
    const membership = membershipUpgrade.membership;

    // Calcular la diferencia de puntos entre el nuevo plan y el anterior
    const priceDifference = toPlan.price - fromPlan.price;
    const pointsDifference = toPlan.binaryPoints - fromPlan.binaryPoints;

    // 1. Procesar bonos directos si tiene referente
    if (user.referrerCode) {
      await this.processDirectBonusUpgrade(
        user,
        toPlan,
        fromPlan,
        priceDifference,
        queryRunner,
      );
    }

    // 2. Actualizar el volumen del usuario que actualiza el plan
    await this.updateUserVolume(user, pointsDifference, queryRunner);

    // 3. Alimentar los volúmenes del árbol (para los padres)
    await this.processTreeVolumesUpgrade(user, pointsDifference, queryRunner);

    // 4. Actualizar la membresía
    membership.plan = toPlan;

    // Si la membresía ya estaba activa, mantenemos las fechas, solo cambiamos el plan
    if (membership.status === MembershipStatus.ACTIVE) {
      // No modificamos las fechas existentes
    } else {
      // Si no estaba activa (caso improbable en una actualización), actualizamos fechas
      const now = new Date();
      const expirationDate = new Date(now);
      expirationDate.setDate(expirationDate.getDate() + 30);

      const nextReconsumptionDate = new Date(expirationDate);
      nextReconsumptionDate.setDate(nextReconsumptionDate.getDate() + 30);

      membership.status = MembershipStatus.ACTIVE;
      membership.startDate = now;
      membership.endDate = expirationDate;
      membership.nextReconsumptionDate = nextReconsumptionDate;
    }

    await queryRunner.manager.save(membership);

    // 5. Actualizar el estado de la actualización de plan
    membershipUpgrade.status = UpgradeStatus.COMPLETED;
    membershipUpgrade.completedDate = new Date();
    await queryRunner.manager.save(membershipUpgrade);

    // 6. Crear registro histórico
    const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.UPGRADED,
      performedBy: payment.reviewedBy,
      notes: 'Plan actualizado exitosamente',
      changes: {
        previousPlanId: fromPlan.id,
        previousPlanName: fromPlan.name,
        newPlanId: toPlan.id,
        newPlanName: toPlan.name,
        upgradeCost: priceDifference,
      },
    });

    await queryRunner.manager.save(membershipHistory);
  }
  private async processDirectBonusUpgrade(
    user: User,
    toPlan: MembershipPlan,
    fromPlan: MembershipPlan,
    priceDifference: number,
    queryRunner: any,
  ) {
    try {
      // Buscar el referente
      const referrer = await this.userRepository.findOne({
        where: { referralCode: user.referrerCode },
        relations: ['role'],
      });

      if (!referrer) {
        this.logger.warn(
          `No se encontró referente con código ${user.referrerCode}`,
        );
        return;
      }

      // Verificar que el referente tenga una membresía activa
      const referrerMembership = await this.membershipRepository.findOne({
        where: {
          user: { id: referrer.id },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      if (!referrerMembership) {
        this.logger.warn(
          `El referente ${referrer.id} no tiene una membresía activa`,
        );
        return;
      }

      const referrerPlan = referrerMembership.plan;

      // Verificar que el plan del referente tenga directCommissionAmount
      if (
        !referrerPlan.directCommissionAmount ||
        referrerPlan.directCommissionAmount <= 0
      ) {
        this.logger.warn(
          `El plan ${referrerPlan.id} del referente no tiene configurada una comisión directa`,
        );
        return;
      }

      // Calcular la comisión directa basada en la diferencia de precio
      const directBonus =
        referrerPlan.directCommissionAmount * (priceDifference / 100);

      // Solo procesamos si hay un bono positivo
      if (directBonus <= 0) {
        this.logger.warn(`No hay bono directo para procesar (${directBonus})`);
        return;
      }

      // Actualizar los puntos del referente
      const referrerPoints = await this.userPointsRepository.findOne({
        where: { user: { id: referrer.id } },
      });

      if (referrerPoints) {
        referrerPoints.availablePoints =
          Number(referrerPoints.availablePoints) + directBonus;
        referrerPoints.totalEarnedPoints =
          Number(referrerPoints.totalEarnedPoints) + directBonus;
        await queryRunner.manager.save(referrerPoints);
      } else {
        const newReferrerPoints = this.userPointsRepository.create({
          user: { id: referrer.id },
          membershipPlan: referrerPlan,
          availablePoints: directBonus,
          totalEarnedPoints: directBonus,
          totalWithdrawnPoints: 0,
        });
        await queryRunner.manager.save(newReferrerPoints);
      }

      // Crear transacción de puntos
      const pointsTransaction = this.pointsTransactionRepository.create({
        user: { id: referrer.id },
        membershipPlan: referrerPlan,
        type: PointTransactionType.DIRECT_BONUS,
        amount: directBonus,
        status: PointTransactionStatus.COMPLETED,
        metadata: {
          referredUserId: user.id,
          isUpgrade: true,
          fromPlan: {
            id: fromPlan.id,
            name: fromPlan.name,
            price: fromPlan.price,
          },
          toPlan: {
            id: toPlan.id,
            name: toPlan.name,
            price: toPlan.price,
          },
          priceDifference: priceDifference,
          commissionPercentage: referrerPlan.directCommissionAmount,
        },
      });

      await queryRunner.manager.save(pointsTransaction);

      this.logger.log(
        `Bono directo por upgrade procesado: ${directBonus} puntos para el usuario ${referrer.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al procesar bono directo por upgrade: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async updateUserVolume(
    user: User,
    pointsDifference: number,
    queryRunner: any,
  ) {
    try {
      if (pointsDifference <= 0) {
        this.logger.warn(
          `No hay diferencia de puntos positiva para procesar (${pointsDifference})`,
        );
        return;
      }

      const userMembership = await this.membershipRepository.findOne({
        where: {
          user: { id: user.id },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      if (!userMembership) {
        this.logger.warn(`El usuario ${user.id} no tiene una membresía activa`);
        return;
      }

      const userPlan = userMembership.plan;
      const userPosition = user.position;
      console.log('userPosition', userPosition);
      const now = new Date();
      const weekStartDate = this.getFirstDayOfWeek(now);
      const weekEndDate = this.getLastDayOfWeek(now);

      const existingVolume = await this.weeklyVolumeRepository.findOne({
        where: {
          user: { id: user.id },
          status: VolumeProcessingStatus.PENDING,
          weekStartDate: weekStartDate,
          weekEndDate: weekEndDate,
        },
      });

      if (existingVolume) {
        if (userPosition == 'LEFT') {
          existingVolume.leftVolume =
            Number(existingVolume.leftVolume) + Number(pointsDifference);
        } else if (userPosition == 'RIGHT') {
          existingVolume.rightVolume =
            Number(existingVolume.rightVolume) + Number(pointsDifference);
        }

        await queryRunner.manager.save(existingVolume);
        this.logger.log(
          `Volumen semanal del usuario ${user.id} actualizado: +${pointsDifference} en ambos lados`,
        );
      } else {
        // Crear nuevo volumen
        const newVolume = this.weeklyVolumeRepository.create({
          user: { id: user.id },
          membershipPlan: userPlan,
          leftVolume: userPosition == 'LEFT' ? pointsDifference : 0,
          rightVolume: userPosition == 'RIGHT' ? pointsDifference : 0,
          weekStartDate: weekStartDate,
          weekEndDate: weekEndDate,
          status: VolumeProcessingStatus.PENDING,
          carryOverVolume: 0,
        });

        await queryRunner.manager.save(newVolume);
        this.logger.log(
          `Nuevo volumen semanal creado para el usuario ${user.id}: ${pointsDifference} en ambos lados`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al actualizar volumen del usuario: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async processTreeVolumesUpgrade(
    user: User,
    pointsDifference: number,
    queryRunner: any,
  ) {
    try {
      // Solo procesamos si hay una diferencia positiva de puntos
      if (pointsDifference <= 0) {
        this.logger.warn(
          `No hay diferencia de puntos positiva para procesar (${pointsDifference})`,
        );
        return;
      }

      // Obtener todos los padres en la estructura del árbol
      const parents = await this.getAllParents(user.id);

      for (const parent of parents) {
        // Verificar que el padre tenga una membresía activa
        const parentMembership = await this.membershipRepository.findOne({
          where: {
            user: { id: parent.id },
            status: MembershipStatus.ACTIVE,
          },
          relations: ['plan'],
        });

        if (!parentMembership) {
          this.logger.debug(
            `El padre ${parent.id} no tiene una membresía activa, saltando`,
          );
          continue;
        }

        const parentPlan = parentMembership.plan;

        // Verificar que el plan del padre tenga porcentaje de comisión
        if (
          !parentPlan.commissionPercentage ||
          parentPlan.commissionPercentage <= 0
        ) {
          this.logger.debug(
            `El plan ${parentPlan.id} del padre no tiene configurado un porcentaje de comisión, saltando`,
          );
          continue;
        }

        // Determinar el lado del árbol
        const side = await this.determineTreeSide(parent.id, user.id);
        if (!side) {
          this.logger.warn(
            `No se pudo determinar el lado del árbol para el usuario ${user.id} con respecto al padre ${parent.id}`,
          );
          continue;
        }

        // Crear o actualizar el volumen semanal
        await this.updateWeeklyVolume(
          parent,
          parentPlan,
          pointsDifference,
          side,
          queryRunner,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar volúmenes del árbol para upgrade: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async processDirectBonus(
    user: User,
    plan: MembershipPlan,
    queryRunner: any,
  ) {
    try {
      // Buscar el referente
      const referrer = await this.userRepository.findOne({
        where: { referralCode: user.referrerCode },
        relations: ['role'],
      });

      if (!referrer) {
        this.logger.warn(
          `No se encontró referente con código ${user.referrerCode}`,
        );
        return;
      }

      // Verificar que el referente tenga una membresía activa
      const referrerMembership = await this.membershipRepository.findOne({
        where: {
          user: { id: referrer.id },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      if (!referrerMembership) {
        this.logger.warn(
          `El referente ${referrer.id} no tiene una membresía activa`,
        );
        return;
      }

      const referrerPlan = referrerMembership.plan;

      // Verificar que el plan del referente tenga directCommissionAmount
      if (
        !referrerPlan.directCommissionAmount ||
        referrerPlan.directCommissionAmount <= 0
      ) {
        this.logger.warn(
          `El plan ${referrerPlan.id} del referente no tiene configurada una comisión directa`,
        );
        return;
      }
      console.log('directBonus', referrerPlan.directCommissionAmount);

      // Calcular la comisión directa
      const directBonus =
        referrerPlan.directCommissionAmount * (plan.price / 100);
      console.log('directBonus', directBonus);

      // Actualizar los puntos del referente
      const referrerPoints = await this.userPointsRepository.findOne({
        where: { user: { id: referrer.id } },
      });

      if (referrerPoints) {
        referrerPoints.availablePoints =
          Number(referrerPoints.availablePoints) + directBonus;
        referrerPoints.totalEarnedPoints =
          Number(referrerPoints.totalEarnedPoints) + directBonus;
        await queryRunner.manager.save(referrerPoints);
      } else {
        const newReferrerPoints = this.userPointsRepository.create({
          user: { id: referrer.id },
          membershipPlan: referrerPlan,
          availablePoints: directBonus,
          totalEarnedPoints: directBonus,
          totalWithdrawnPoints: 0,
        });
        await queryRunner.manager.save(newReferrerPoints);
      }

      // Crear transacción de puntos
      const pointsTransaction = this.pointsTransactionRepository.create({
        user: { id: referrer.id },
        membershipPlan: referrerPlan,
        type: PointTransactionType.DIRECT_BONUS,
        amount: directBonus,
        status: PointTransactionStatus.COMPLETED,
        metadata: {
          referredUserId: user.id,
          planId: plan.id,
          planName: plan.name,
          planPrice: plan.price,
          commissionPercentage: referrerPlan.directCommissionAmount,
        },
      });

      await queryRunner.manager.save(pointsTransaction);

      this.logger.log(
        `Bono directo procesado: ${directBonus} puntos para el usuario ${referrer.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al procesar bono directo: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async processTreeVolumes(
    user: User,
    plan: MembershipPlan,
    queryRunner: any,
  ) {
    try {
      // Obtener todos los padres en la estructura del árbol
      const parents = await this.getAllParents(user.id);

      for (const parent of parents) {
        // Verificar que el padre tenga una membresía activa
        const parentMembership = await this.membershipRepository.findOne({
          where: {
            user: { id: parent.id },
            status: MembershipStatus.ACTIVE,
          },
          relations: ['plan'],
        });

        if (!parentMembership) {
          this.logger.debug(
            `El padre ${parent.id} no tiene una membresía activa, saltando`,
          );
          continue;
        }

        const parentPlan = parentMembership.plan;

        // Verificar que el plan del padre tenga porcentaje de comisión
        if (
          !parentPlan.commissionPercentage ||
          parentPlan.commissionPercentage <= 0
        ) {
          this.logger.debug(
            `El plan ${parentPlan.id} del padre no tiene configurado un porcentaje de comisión, saltando`,
          );
          continue;
        }

        // Determinar el lado del árbol
        const side = await this.determineTreeSide(parent.id, user.id);
        if (!side) {
          this.logger.warn(
            `No se pudo determinar el lado del árbol para el usuario ${user.id} con respecto al padre ${parent.id}`,
          );
          continue;
        }

        // Crear o actualizar el volumen semanal
        await this.updateWeeklyVolume(
          parent,
          parentPlan,
          plan.binaryPoints,
          side,
          queryRunner,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar volúmenes del árbol: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async getAllParents(userId: string): Promise<User[]> {
    const parents: User[] = [];
    let currentUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['parent'],
    });

    while (currentUser && currentUser.parent) {
      parents.push(currentUser.parent);

      currentUser = await this.userRepository.findOne({
        where: { id: currentUser.parent.id },
        relations: ['parent'],
      });
    }

    return parents;
  }

  private async determineTreeSide(
    parentId: string,
    childId: string,
  ): Promise<VolumeSide | null> {
    // Verificar primero si es hijo directo
    const parent = await this.userRepository.findOne({
      where: { id: parentId },
      relations: ['leftChild', 'rightChild'],
    });

    if (parent.leftChild && parent.leftChild.id === childId) {
      return VolumeSide.LEFT;
    }

    if (parent.rightChild && parent.rightChild.id === childId) {
      return VolumeSide.RIGHT;
    }

    // Si no es hijo directo, verificar recursivamente
    // Esta es una implementación simplificada. En un sistema real,
    // probablemente necesitarías una consulta SQL más optimizada.
    const isLeftDescendant = await this.isDescendantOfSide(
      parentId,
      childId,
      VolumeSide.LEFT,
    );
    if (isLeftDescendant) {
      return VolumeSide.LEFT;
    }

    const isRightDescendant = await this.isDescendantOfSide(
      parentId,
      childId,
      VolumeSide.RIGHT,
    );
    if (isRightDescendant) {
      return VolumeSide.RIGHT;
    }

    return null;
  }

  private async isDescendantOfSide(
    ancestorId: string,
    descendantId: string,
    side: VolumeSide,
  ): Promise<boolean> {
    const ancestor = await this.userRepository.findOne({
      where: { id: ancestorId },
      relations: ['leftChild', 'rightChild'],
    });

    if (!ancestor) return false;

    const childId =
      side === VolumeSide.LEFT
        ? ancestor.leftChild?.id
        : ancestor.rightChild?.id;

    if (!childId) return false;
    if (childId === descendantId) return true;

    // Verificar recursivamente en ambos lados del hijo
    const child = await this.userRepository.findOne({
      where: { id: childId },
      relations: ['leftChild', 'rightChild'],
    });

    if (!child) return false;

    if (child.leftChild) {
      const isLeftDescendant = await this.isDescendantOfSide(
        child.id,
        descendantId,
        VolumeSide.LEFT,
      );
      if (isLeftDescendant) return true;
    }

    if (child.rightChild) {
      const isRightDescendant = await this.isDescendantOfSide(
        child.id,
        descendantId,
        VolumeSide.RIGHT,
      );
      if (isRightDescendant) return true;
    }

    return false;
  }

  private async updateWeeklyVolume(
    parent: User,
    parentPlan: MembershipPlan,
    binaryPoints: number,
    side: VolumeSide,
    queryRunner: any,
  ) {
    try {
      // Calcular fechas de la semana actual
      const now = new Date();
      const weekStartDate = this.getFirstDayOfWeek(now);
      const weekEndDate = this.getLastDayOfWeek(now);

      // Buscar si ya existe un volumen para esta semana
      const existingVolume = await this.weeklyVolumeRepository.findOne({
        where: {
          user: { id: parent.id },
          status: VolumeProcessingStatus.PENDING,
          weekStartDate: weekStartDate,
          weekEndDate: weekEndDate,
        },
      });
      console.log('side', side);

      if (existingVolume) {
        // Actualizar volumen existente
        if (side == VolumeSide.LEFT) {
          existingVolume.leftVolume =
            Number(existingVolume.leftVolume) + Number(binaryPoints);
        } else {
          existingVolume.rightVolume =
            Number(existingVolume.rightVolume) + Number(binaryPoints);
        }

        await queryRunner.manager.save(existingVolume);
        this.logger.log(
          `Volumen semanal actualizado para usuario ${parent.id}: +${binaryPoints} en lado ${side}`,
        );
      } else {
        // Crear nuevo volumen
        const newVolume = this.weeklyVolumeRepository.create({
          user: { id: parent.id },
          membershipPlan: parentPlan,
          leftVolume: side == VolumeSide.LEFT ? binaryPoints : 0,
          rightVolume: side == VolumeSide.RIGHT ? binaryPoints : 0,
          weekStartDate: weekStartDate,
          weekEndDate: weekEndDate,
          status: VolumeProcessingStatus.PENDING,
          carryOverVolume: 0,
        });

        await queryRunner.manager.save(newVolume);
        this.logger.log(
          `Nuevo volumen semanal creado para usuario ${parent.id}: ${binaryPoints} en lado ${side}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al actualizar volumen semanal: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private getFirstDayOfWeek(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajustar cuando el día es domingo
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private getLastDayOfWeek(date: Date): Date {
    const firstDay = this.getFirstDayOfWeek(date);
    const sunday = new Date(firstDay);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  }
}
