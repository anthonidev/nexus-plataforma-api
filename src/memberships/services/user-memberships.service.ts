import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Membership, MembershipStatus } from '../entities/membership.entity';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { User } from 'src/user/entities/user.entity';
import { CreateMembershipSubscriptionDto } from '../dto/create-membership-subscription.dto';
import { Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import { PaymentImage } from 'src/payments/entities/payment-image.entity';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { ApproveMembershipSubscriptionDto } from '../dto/approve-membership-subscription.dto';
import {
  MembershipHistory,
  MembershipAction,
} from '../entities/membership_history.entity';

@Injectable()
export class UserMembershipsService {
  private readonly logger = new Logger(UserMembershipsService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipPlan)
    private readonly planRepository: Repository<MembershipPlan>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentImage)
    private readonly paymentImageRepository: Repository<PaymentImage>,
    @InjectRepository(PaymentConfig)
    private readonly paymentConfigRepository: Repository<PaymentConfig>,
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea una solicitud de suscripción a un plan de membresía
   */
  async createSubscription(
    userId: string,
    createDto: CreateMembershipSubscriptionDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el usuario existe
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      // Verificar que el plan existe
      const plan = await this.planRepository.findOne({
        where: { id: createDto.planId },
      });

      if (!plan) {
        throw new NotFoundException(
          `Plan con ID ${createDto.planId} no encontrado`,
        );
      }

      // Verificar si el usuario ya tiene una membresía activa
      const existingActiveMembership = await this.membershipRepository.findOne({
        where: {
          user: { id: userId },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      if (existingActiveMembership) {
        throw new ConflictException(
          `El usuario ya tiene una membresía activa (Plan: ${existingActiveMembership.plan.name})`,
        );
      }

      // Verificar si hay una solicitud pendiente
      const existingPendingMembership = await this.membershipRepository.findOne(
        {
          where: {
            user: { id: userId },
            status: MembershipStatus.PENDING,
          },
        },
      );

      if (existingPendingMembership) {
        throw new ConflictException(
          'El usuario ya tiene una solicitud de membresía pendiente',
        );
      }

      // Obtener la configuración de pago para membresías
      const paymentConfig = await this.paymentConfigRepository.findOne({
        where: { code: 'MEMBERSHIP_PAYMENT' },
      });

      if (!paymentConfig || !paymentConfig.isActive) {
        throw new BadRequestException(
          'La opción de pago para membresías no está disponible',
        );
      }

      // Validar el monto del pago
      if (
        createDto.paymentImage.amount < plan.price ||
        Math.abs(createDto.paymentImage.amount - plan.price) > 0.01
      ) {
        throw new BadRequestException(
          `El monto del pago (${createDto.paymentImage.amount}) no coincide con el precio del plan (${plan.price})`,
        );
      }

      // Crear la membresía
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // Membresía por 1 año

      // Calcular fecha de próximo reconsumo (30 días desde hoy)
      const nextReconsumptionDate = new Date();
      nextReconsumptionDate.setDate(nextReconsumptionDate.getDate() + 30);

      const membership = this.membershipRepository.create({
        user: { id: userId },
        plan: { id: plan.id },
        startDate,
        endDate,
        status: MembershipStatus.PENDING, // Pendiente hasta que se apruebe el pago
        paidAmount: createDto.paymentImage.amount,
        paymentReference: createDto.paymentReference,
        minimumReconsumptionAmount: 300, // Valor por defecto
        nextReconsumptionDate,
        accumulatedBinaryPoints: 0,
        autoRenewal: false,
      });

      const savedMembership = await queryRunner.manager.save(membership);

      // Crear el pago
      const payment = this.paymentRepository.create({
        user: { id: userId },
        paymentConfig: { id: paymentConfig.id },
        amount: createDto.paymentImage.amount,
        status: PaymentStatus.PENDING,
        relatedEntityType: 'membership',
        relatedEntityId: savedMembership.id,
        metadata: {
          planId: plan.id,
          planName: plan.name,
        },
      });

      const savedPayment = await queryRunner.manager.save(payment);

      // Crear la imagen de pago
      const paymentImage = this.paymentImageRepository.create({
        payment: { id: savedPayment.id },
        url: createDto.paymentImage.url,
        amount: createDto.paymentImage.amount,
        bankName: createDto.paymentImage.bankName,
        transactionReference: createDto.paymentImage.transactionReference,
        transactionDate: new Date(createDto.paymentImage.transactionDate),
        isActive: true,
      });

      await queryRunner.manager.save(paymentImage);

      // Registrar en el historial
      const membershipHistory = this.membershipHistoryRepository.create({
        membership: { id: savedMembership.id },
        action: MembershipAction.CREATED,
        notes: createDto.notes || 'Solicitud de membresía creada',
        metadata: {
          planId: plan.id,
          planName: plan.name,
          paymentId: savedPayment.id,
        },
      });

      await queryRunner.manager.save(membershipHistory);

      await queryRunner.commitTransaction();

      return {
        id: savedMembership.id,
        status: savedMembership.status,
        message:
          'Solicitud de membresía creada exitosamente. Pendiente de aprobación.',
        paymentId: savedPayment.id,
        planName: plan.name,
        amount: createDto.paymentImage.amount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al crear suscripción: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Aprueba o rechaza una solicitud de suscripción
   */
  async approveSubscription(
    adminId: string,
    membershipId: number,
    approveDto: ApproveMembershipSubscriptionDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el administrador existe
      const admin = await this.userRepository.findOne({
        where: { id: adminId },
        relations: ['role'],
      });

      if (!admin) {
        throw new NotFoundException(
          `Administrador con ID ${adminId} no encontrado`,
        );
      }

      // Verificar que el administrador tiene permisos
      if (!['SYS', 'ADM'].includes(admin.role.code)) {
        throw new UnauthorizedException(
          'No tienes permisos para realizar esta acción',
        );
      }

      // Verificar que la membresía existe y está pendiente
      const membership = await this.membershipRepository.findOne({
        where: { id: membershipId },
        relations: ['user', 'plan'],
      });

      if (!membership) {
        throw new NotFoundException(
          `Membresía con ID ${membershipId} no encontrada`,
        );
      }

      if (membership.status !== MembershipStatus.PENDING) {
        throw new BadRequestException(
          `La membresía no está pendiente, su estado actual es: ${membership.status}`,
        );
      }

      // Buscar el pago asociado
      const payment = await this.paymentRepository.findOne({
        where: {
          relatedEntityType: 'membership',
          relatedEntityId: membershipId,
        },
      });

      if (!payment) {
        throw new NotFoundException(
          `Pago asociado a la membresía ${membershipId} no encontrado`,
        );
      }

      const now = new Date();

      // Actualizar el estado de la membresía y el pago
      if (approveDto.approved) {
        // Aprobar membresía
        membership.status = MembershipStatus.ACTIVE;

        // Actualizar el pago
        payment.status = PaymentStatus.APPROVED;
        payment.reviewedBy = admin;
        payment.reviewedAt = now;
      } else {
        // Rechazar membresía
        membership.status = MembershipStatus.INACTIVE;

        // Actualizar el pago
        payment.status = PaymentStatus.REJECTED;
        payment.reviewedBy = admin;
        payment.reviewedAt = now;
        payment.rejectionReason =
          approveDto.rejectionReason ||
          'Solicitud rechazada por el administrador';
      }

      await queryRunner.manager.save(membership);
      await queryRunner.manager.save(payment);

      // Registrar en el historial
      const membershipHistory = this.membershipHistoryRepository.create({
        membership: { id: membershipId },
        performedBy: { id: adminId },
        action: approveDto.approved
          ? MembershipAction.CREATED
          : MembershipAction.CANCELLED,
        notes:
          approveDto.notes ||
          (approveDto.approved
            ? 'Solicitud de membresía aprobada'
            : `Solicitud de membresía rechazada: ${approveDto.rejectionReason}`),
        metadata: {
          approved: approveDto.approved,
          paymentId: payment.id,
        },
      });

      await queryRunner.manager.save(membershipHistory);

      await queryRunner.commitTransaction();

      return {
        id: membership.id,
        status: membership.status,
        message: approveDto.approved
          ? `Membresía activada exitosamente para el usuario ${membership.user.id}`
          : `Membresía rechazada para el usuario ${membership.user.id}`,
        plan: {
          id: membership.plan.id,
          name: membership.plan.name,
        },
        paymentStatus: payment.status,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al aprobar/rechazar suscripción: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtiene las membresías de un usuario
   */
  async getUserMemberships(userId: string) {
    try {
      const memberships = await this.membershipRepository.find({
        where: { user: { id: userId } },
        relations: ['plan'],
        order: { createdAt: 'DESC' },
      });

      return memberships.map((membership) => ({
        id: membership.id,
        status: membership.status,
        planName: membership.plan.name,
        planId: membership.plan.id,
        startDate: membership.startDate,
        endDate: membership.endDate,
        paidAmount: membership.paidAmount,
        nextReconsumptionDate: membership.nextReconsumptionDate,
        accumulatedBinaryPoints: membership.accumulatedBinaryPoints,
      }));
    } catch (error) {
      this.logger.error(
        `Error al obtener membresías del usuario ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Obtiene el detalle de una membresía
   */
  async getMembershipDetail(userId: string, membershipId: number) {
    try {
      const membership = await this.membershipRepository.findOne({
        where: {
          id: membershipId,
          user: { id: userId },
        },
        relations: ['plan', 'reconsumptions', 'upgrades'],
      });

      if (!membership) {
        throw new NotFoundException(
          `Membresía con ID ${membershipId} no encontrada para el usuario`,
        );
      }

      // Buscar el historial
      const history = await this.membershipHistoryRepository.find({
        where: { membership: { id: membershipId } },
        order: { createdAt: 'DESC' },
        relations: ['performedBy'],
      });

      // Buscar pagos relacionados
      const payments = await this.paymentRepository.find({
        where: {
          relatedEntityType: 'membership',
          relatedEntityId: membershipId,
        },
        relations: ['reviewedBy', 'images'],
        order: { createdAt: 'DESC' },
      });

      return {
        id: membership.id,
        status: membership.status,
        plan: {
          id: membership.plan.id,
          name: membership.plan.name,
          price: membership.plan.price,
          binaryPoints: membership.plan.binaryPoints,
          benefits: membership.plan.benefits,
          products: membership.plan.products,
        },
        startDate: membership.startDate,
        endDate: membership.endDate,
        paidAmount: membership.paidAmount,
        paymentReference: membership.paymentReference,
        nextReconsumptionDate: membership.nextReconsumptionDate,
        minimumReconsumptionAmount: membership.minimumReconsumptionAmount,
        accumulatedBinaryPoints: membership.accumulatedBinaryPoints,
        autoRenewal: membership.autoRenewal,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
        payments: payments.map((payment) => ({
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          createdAt: payment.createdAt,
          reviewedAt: payment.reviewedAt,
          reviewedBy: payment.reviewedBy
            ? { id: payment.reviewedBy.id, email: payment.reviewedBy.email }
            : null,
          images: payment.images.map((image) => ({
            id: image.id,
            url: image.url,
            transactionReference: image.transactionReference,
            transactionDate: image.transactionDate,
            amount: image.amount,
          })),
        })),
        history: history.map((record) => ({
          id: record.id,
          action: record.action,
          createdAt: record.createdAt,
          notes: record.notes,
          performedBy: record.performedBy
            ? { id: record.performedBy.id, email: record.performedBy.email }
            : null,
        })),
        reconsumptions: membership.reconsumptions.map((reconsumption) => ({
          id: reconsumption.id,
          status: reconsumption.status,
          amount: reconsumption.amount,
          periodDate: reconsumption.periodDate,
          createdAt: reconsumption.createdAt,
        })),
        upgrades: membership.upgrades.map((upgrade) => ({
          id: upgrade.id,
          status: upgrade.status,
          fromPlanId: upgrade.fromPlan.id,
          toPlanId: upgrade.toPlan.id,
          upgradeCost: upgrade.upgradeCost,
          completedDate: upgrade.completedDate,
          createdAt: upgrade.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener detalle de membresía ${membershipId}: ${error.message}`,
      );
      throw error;
    }
  }
}
