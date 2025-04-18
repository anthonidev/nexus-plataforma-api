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
import {
  MonthlyVolumeRank,
  MonthlyVolumeStatus,
} from 'src/ranks/entities/monthly_volume_ranks.entity';
import { Rank } from 'src/ranks/entities/ranks.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { RejectPaymentDto } from '../dto/approval.dto';
import { ApprovePaymentDto } from '../dto/approve-payment.dto';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import {
  MembershipReconsumption,
  ReconsumptionStatus,
} from 'src/memberships/entities/membership-recosumption.entity';
import {
  getDates,
  getFirstDayOfMonth,
  getFirstDayOfWeek,
  getLastDayOfMonth,
  getLastDayOfWeek,
} from 'src/utils/dates';

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

    @InjectRepository(MembershipReconsumption)
    private readonly reconsumptionRepository: Repository<MembershipReconsumption>,

    @InjectRepository(Rank)
    private readonly rankRepository: Repository<Rank>,
    @InjectRepository(UserRank)
    private readonly userRankRepository: Repository<UserRank>,
    @InjectRepository(MonthlyVolumeRank)
    private readonly monthlyVolumeRankRepository: Repository<MonthlyVolumeRank>,
    private readonly dataSource: DataSource,
  ) {}

  async approvePayment(
    paymentId: number,
    reviewerId: string,
    approvePaymentDto: ApprovePaymentDto,
  ) {
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

      payment.status = PaymentStatus.APPROVED;
      payment.reviewedBy = reviewer;
      payment.reviewedAt = new Date();

      payment.codeOperation = approvePaymentDto.codeOperation;
      payment.banckName = approvePaymentDto.banckName;
      payment.dateOperation = new Date(approvePaymentDto.dateOperation);
      payment.numberTicket = approvePaymentDto.numberTicket;

      await queryRunner.manager.save(payment);

      switch (payment.paymentConfig.code) {
        case 'MEMBERSHIP_PAYMENT':
          await this.processMembershipPayment(payment, queryRunner);
          break;
        case 'RECONSUMPTION':
          await this.processReconsumptionPayment(payment, queryRunner);
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
      } else if (
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
      } else if (
        payment.paymentConfig.code === 'RECONSUMPTION' &&
        payment.relatedEntityType === 'membership_reconsumption'
      ) {
        await this.processReconsumptionRejection(
          payment,
          rejectPaymentDto.rejectionReason,
          queryRunner,
        );
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
  private async processReconsumptionRejection(
    payment: Payment,
    rejectionReason: string,
    queryRunner: any,
  ) {
    if (payment.relatedEntityType !== 'membership_reconsumption') {
      throw new BadRequestException(
        'El pago no está relacionado a un reconsumo',
      );
    }

    const reconsumption = await this.reconsumptionRepository.findOne({
      where: { id: payment.relatedEntityId },
      relations: ['membership', 'membership.user'],
    });

    if (!reconsumption) {
      throw new NotFoundException(
        `Reconsumo con ID ${payment.relatedEntityId} no encontrado`,
      );
    }

    if (reconsumption.status !== ReconsumptionStatus.PENDING) {
      throw new BadRequestException(`El reconsumo no está en estado pendiente`);
    }

    const membership = reconsumption.membership;

    // Actualizar reconsumo a CANCELLED
    reconsumption.status = ReconsumptionStatus.CANCELLED;
    await queryRunner.manager.save(reconsumption);

    // Registrar historial
    const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.STATUS_CHANGED,
      performedBy: payment.reviewedBy,
      notes: `Reconsumo rechazado: ${rejectionReason}`,
      changes: {
        reconsumptionId: reconsumption.id,
        reconsumptionStatus: {
          previous: ReconsumptionStatus.PENDING,
          new: ReconsumptionStatus.CANCELLED,
        },
        rejectionReason,
      },
    });

    await queryRunner.manager.save(membershipHistory);

    this.logger.log(
      `Reconsumo ${reconsumption.id} rechazado: ${rejectionReason}`,
    );
  }
  private async processReconsumptionPayment(
    payment: Payment,
    queryRunner: any,
  ) {
    if (payment.relatedEntityType !== 'membership_reconsumption') {
      throw new BadRequestException(
        'El pago no está relacionado a un reconsumo',
      );
    }

    const reconsumption = await this.reconsumptionRepository.findOne({
      where: { id: payment.relatedEntityId },
      relations: ['membership', 'membership.user', 'membership.plan'],
    });

    if (!reconsumption) {
      throw new NotFoundException(
        `Reconsumo con ID ${payment.relatedEntityId} no encontrado`,
      );
    }

    if (reconsumption.status !== ReconsumptionStatus.PENDING) {
      throw new BadRequestException(`El reconsumo no está en estado pendiente`);
    }

    const membership = reconsumption.membership;
    const user = membership.user;
    const plan = membership.plan;

    // Validar fechas para reconsumo
    const today = new Date();
    const nextReconsumptionDate = new Date(membership.nextReconsumptionDate);

    if (today < nextReconsumptionDate) {
      throw new BadRequestException(
        `No es posible aprobar el reconsumo. La fecha de reconsumo (${nextReconsumptionDate.toISOString().split('T')[0]}) aún no ha llegado.`,
      );
    }

    // Actualizar fechas de membresía
    const oldStartDate = new Date(membership.startDate);
    const oldEndDate = new Date(membership.endDate);

    // Calcular nuevas fechas
    const newStartDate = new Date(oldStartDate);
    newStartDate.setMonth(newStartDate.getMonth() + 1);

    const newEndDate = new Date(oldEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + 1);

    const newNextReconsumptionDate = new Date(newEndDate);
    newNextReconsumptionDate.setDate(newNextReconsumptionDate.getDate() + 1);

    // Actualizar membresía
    membership.startDate = newStartDate;
    membership.endDate = newEndDate;
    membership.nextReconsumptionDate = newNextReconsumptionDate;
    await queryRunner.manager.save(membership);

    // Actualizar reconsumo
    reconsumption.status = ReconsumptionStatus.ACTIVE;
    await queryRunner.manager.save(reconsumption);

    // Procesar volúmenes del árbol con el monto de reconsumo
    const minimumReconsumptionAmount = membership.minimumReconsumptionAmount;
    await this.processTreeVolumesReConsumption(
      user,
      plan,
      minimumReconsumptionAmount,
      queryRunner,
    );

    // Registrar historial
    const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.RENEWED,
      performedBy: payment.reviewedBy,
      notes: 'Reconsumo aprobado',
      changes: {
        previousStartDate: oldStartDate,
        newStartDate: newStartDate,
        previousEndDate: oldEndDate,
        newEndDate: newEndDate,
        previousNextReconsumptionDate: nextReconsumptionDate,
        newNextReconsumptionDate: newNextReconsumptionDate,
        reconsumptionAmount: reconsumption.amount,
      },
    });

    await queryRunner.manager.save(membershipHistory);

    this.logger.log(
      `Reconsumo procesado exitosamente para la membresía ${membership.id}`,
    );
  }

  private async processTreeVolumesReConsumption(
    user: User,
    plan: MembershipPlan,
    reconsumptionAmount: number,
    queryRunner: any,
  ) {
    try {
      const parents = await this.getAllParents(user.id);

      for (const parent of parents) {
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

        if (
          !parentPlan.commissionPercentage ||
          parentPlan.commissionPercentage <= 0
        ) {
          this.logger.debug(
            `El plan ${parentPlan.id} del padre no tiene configurado un porcentaje de comisión, saltando`,
          );
          continue;
        }

        const side = await this.determineTreeSide(parent.id, user.id);
        if (!side) {
          this.logger.warn(
            `No se pudo determinar el lado del árbol para el usuario ${user.id} con respecto al padre ${parent.id}`,
          );
          continue;
        }

        await this.updateWeeklyVolume(
          parent,
          parentPlan,
          reconsumptionAmount,
          side,
          queryRunner,
        );

        await this.updateMonthlyVolume(
          parent,
          parentPlan,
          reconsumptionAmount,
          side,
          queryRunner,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar volúmenes del árbol para reconsumo: ${error.message}`,
        error.stack,
      );
      throw error;
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

    if (user.referrerCode) {
      await this.processDirectBonus(user, plan, queryRunner);
    }
    await this.processTreeVolumes(user, plan, queryRunner);
    await this.createOrUpdateUserRank(user, plan, queryRunner);
    const now = new Date();
    const dates = getDates(now);

    membership.status = MembershipStatus.ACTIVE;

    membership.startDate = dates.startDate;
    membership.endDate = dates.endDate;
    membership.nextReconsumptionDate = dates.nextReconsumptionDate;

    await queryRunner.manager.save(membership);

    const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.STATUS_CHANGED,
      performedBy: payment.reviewedBy,
      notes: 'Membresía activada por aprobación de pago',
      changes: {
        previousStatus: MembershipStatus.PENDING,
        newStatus: MembershipStatus.ACTIVE,
        startDate: now,
        endDate: membership.endDate,
        nextReconsumptionDate: membership.nextReconsumptionDate,
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

    const priceDifference = toPlan.price - fromPlan.price;
    const pointsDifference = toPlan.binaryPoints - fromPlan.binaryPoints;

    if (user.referrerCode) {
      await this.processDirectBonusUpgrade(
        user,
        toPlan,
        fromPlan,
        priceDifference,
        queryRunner,
      );
    }

    await this.processTreeVolumesUpgrade(user, pointsDifference, queryRunner);
    await this.createOrUpdateUserRank(user, toPlan, queryRunner);
    membership.plan = toPlan;

    if (membership.status === MembershipStatus.ACTIVE) {
    } else {
      const now = new Date();
      const dates = getDates(now);

      membership.status = MembershipStatus.ACTIVE;

      membership.startDate = dates.startDate;
      membership.endDate = dates.endDate;
      membership.nextReconsumptionDate = dates.nextReconsumptionDate;
    }

    await queryRunner.manager.save(membership);

    membershipUpgrade.status = UpgradeStatus.COMPLETED;
    membershipUpgrade.completedDate = new Date();
    await queryRunner.manager.save(membershipUpgrade);

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

      if (
        !referrerPlan.directCommissionAmount ||
        referrerPlan.directCommissionAmount <= 0
      ) {
        this.logger.warn(
          `El plan ${referrerPlan.id} del referente no tiene configurada una comisión directa`,
        );
        return;
      }

      const directBonus =
        referrerPlan.directCommissionAmount * (priceDifference / 100);

      if (directBonus <= 0) {
        this.logger.warn(`No hay bono directo para procesar (${directBonus})`);
        return;
      }

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
  private async createOrUpdateUserRank(
    user: User,
    plan: MembershipPlan,
    queryRunner: any,
  ) {
    try {
      const bronzeRank = await this.rankRepository.findOne({
        where: { code: 'BRONZE' },
      });

      if (!bronzeRank) {
        this.logger.warn('No se encontró el rango BRONZE');
        return;
      }

      const existingUserRank = await this.userRankRepository.findOne({
        where: { user: { id: user.id } },
      });

      if (existingUserRank) {
        existingUserRank.membershipPlan = plan;
        await queryRunner.manager.save(existingUserRank);
      } else {
        const newUserRank = this.userRankRepository.create({
          user: { id: user.id },
          membershipPlan: plan,
          currentRank: bronzeRank,
          highestRank: bronzeRank,
        });

        await queryRunner.manager.save(newUserRank);
      }

      this.logger.log(`UserRank creado/actualizado para usuario ${user.id}`);
    } catch (error) {
      this.logger.error(
        `Error al crear/actualizar UserRank: ${error.message}`,
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
      if (pointsDifference <= 0) {
        this.logger.warn(
          `No hay diferencia de puntos positiva para procesar (${pointsDifference})`,
        );
        return;
      }

      const parents = await this.getAllParents(user.id);

      for (const parent of parents) {
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

        if (
          !parentPlan.commissionPercentage ||
          parentPlan.commissionPercentage <= 0
        ) {
          this.logger.debug(
            `El plan ${parentPlan.id} del padre no tiene configurado un porcentaje de comisión, saltando`,
          );
          continue;
        }

        const side = await this.determineTreeSide(parent.id, user.id);
        if (!side) {
          this.logger.warn(
            `No se pudo determinar el lado del árbol para el usuario ${user.id} con respecto al padre ${parent.id}`,
          );
          continue;
        }

        await this.updateWeeklyVolume(
          parent,
          parentPlan,
          pointsDifference,
          side,
          queryRunner,
        );
        await this.updateMonthlyVolume(
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

      const directBonus =
        referrerPlan.directCommissionAmount * (plan.price / 100);
      console.log('directBonus', directBonus);

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
      const parents = await this.getAllParents(user.id);

      for (const parent of parents) {
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

        if (
          !parentPlan.commissionPercentage ||
          parentPlan.commissionPercentage <= 0
        ) {
          this.logger.debug(
            `El plan ${parentPlan.id} del padre no tiene configurado un porcentaje de comisión, saltando`,
          );
          continue;
        }

        const side = await this.determineTreeSide(parent.id, user.id);
        if (!side) {
          this.logger.warn(
            `No se pudo determinar el lado del árbol para el usuario ${user.id} con respecto al padre ${parent.id}`,
          );
          continue;
        }

        await this.updateWeeklyVolume(
          parent,
          parentPlan,
          plan.binaryPoints,
          side,
          queryRunner,
        );
        await this.updateMonthlyVolume(
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
      const now = new Date();
      const weekStartDate = getFirstDayOfWeek(now);
      const weekEndDate = getLastDayOfWeek(now);

      const existingVolume = await this.weeklyVolumeRepository.findOne({
        where: {
          user: { id: parent.id },
          status: VolumeProcessingStatus.PENDING,
          weekStartDate: weekStartDate,
          weekEndDate: weekEndDate,
        },
      });

      if (existingVolume) {
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
  private async updateMonthlyVolume(
    parent: User,
    parentPlan: MembershipPlan,
    binaryPoints: number,
    side: VolumeSide,
    queryRunner: any,
  ) {
    try {
      const now = new Date();
      const monthStartDate = getFirstDayOfMonth(now);
      // Obtener el último día del mes correctamente - el día 0 del mes siguiente es el último día del mes actual
      const monthEndDate = getLastDayOfMonth(now);
      const existingVolume = await this.monthlyVolumeRankRepository.findOne({
        where: {
          user: { id: parent.id },
          status: MonthlyVolumeStatus.PENDING,
          monthStartDate: monthStartDate,
          monthEndDate: monthEndDate,
        },
      });
      if (existingVolume) {
        if (side === VolumeSide.LEFT) {
          existingVolume.leftVolume =
            Number(existingVolume.leftVolume) + Number(binaryPoints);
          existingVolume.leftDirects = existingVolume.leftDirects || 0;
        } else {
          existingVolume.rightVolume =
            Number(existingVolume.rightVolume) + Number(binaryPoints);
          existingVolume.rightDirects = existingVolume.rightDirects || 0;
        }

        existingVolume.totalVolume =
          Number(existingVolume.leftVolume) +
          Number(existingVolume.rightVolume);

        await queryRunner.manager.save(existingVolume);
        this.logger.log(
          `Volumen mensual actualizado para usuario ${parent.id}: +${binaryPoints} en lado ${side}`,
        );
      } else {
        const newVolume = this.monthlyVolumeRankRepository.create({
          user: { id: parent.id },
          membershipPlan: parentPlan,
          leftVolume: side === VolumeSide.LEFT ? binaryPoints : 0,
          rightVolume: side === VolumeSide.RIGHT ? binaryPoints : 0,
          totalVolume: binaryPoints,
          leftDirects: 0,
          rightDirects: 0,
          monthStartDate: monthStartDate,
          monthEndDate: monthEndDate,
          status: MonthlyVolumeStatus.PENDING,
        });

        await queryRunner.manager.save(newVolume);
        this.logger.log(
          `Nuevo volumen mensual creado para usuario ${parent.id}: ${binaryPoints} en lado ${side}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al actualizar volumen mensual: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
