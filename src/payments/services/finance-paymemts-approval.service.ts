import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Membership, MembershipStatus } from 'src/memberships/entities/membership.entity';
import { MembershipAction, MembershipHistory } from 'src/memberships/entities/membership_history.entity';
import { MembershipUpgrade, UpgradeStatus } from 'src/memberships/entities/membership_upgrades.entity';
import { NotificationFactory } from 'src/notifications/factory/notification.factory';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { RejectPaymentDto } from '../dto/approval.dto';
import { ApprovePaymentDto } from '../dto/approve-payment.dto';
import { CompletePaymentDto } from '../dto/complete-payment.dto';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { MembershipPaymentService } from './membership-payment.service';
import { OrderPaymentService } from './order-payment.service';
import { PlanUpgradeService } from './plan-upgrade.service';
import { ReconsumptionService } from './reconsumption.service';

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
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(MembershipUpgrade)
    private readonly membershipUpgradeRepository: Repository<MembershipUpgrade>,
    private readonly notificationFactory: NotificationFactory,
    private readonly dataSource: DataSource,
    private readonly membershipPaymentService: MembershipPaymentService,
    private readonly reconsumptionService: ReconsumptionService,
    private readonly planUpgradeService: PlanUpgradeService,
    private readonly orderPaymentService: OrderPaymentService,

  ) {
  }

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
      payment.metadata = {
        "Configuración de Pago": payment.paymentConfig.code,
        "Estado del Pago": PaymentStatus.APPROVED,
        "Monto": payment.amount,
        "Descripción": `Pago aprobado el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`,
      };

      await queryRunner.manager.save(payment);

      switch (payment.paymentConfig.code) {
        case 'MEMBERSHIP_PAYMENT':
          await this.membershipPaymentService.processMembershipPayment(payment, queryRunner);
          break;
        case 'RECONSUMPTION':
          await this.reconsumptionService.processReconsumptionPayment(payment, queryRunner);
          break;
        case 'PLAN_UPGRADE':
          await this.planUpgradeService.processPlanUpgradePayment(payment, queryRunner);
          break;
        case 'ORDER_PAYMENT':
          await this.orderPaymentService.processOrderPayment(payment, queryRunner);
          break;
        default:
          this.logger.warn(
            `Tipo de pago desconocido: ${payment.paymentConfig.code}`,
          );

      }

      try {
        await this.notificationFactory.paymentApproved(
          payment.user.id,
          payment.amount,
          payment.id,
          payment.paymentConfig.code,
        );
      } catch (notificationError) {
        this.logger.error(
          `Error al enviar notificación de aprobación: ${notificationError.message}`,
          notificationError.stack,
        );
      }

      await queryRunner.commitTransaction();

      return this.operationPaymentResponse(
        payment.user.id,
        `Pago aprobado correctamente`,
        payment,
        reviewer,
      );
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
              'Estado actual': 'Pendiente',
              'Nuevo estado': 'Inactivo',
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
            relations: ['membership', 'fromPlan', 'toPlan'],
          });

        if (
          membershipUpgrade &&
          membershipUpgrade.status === UpgradeStatus.PENDING
        ) {
          membershipUpgrade.status = UpgradeStatus.CANCELLED;
          await queryRunner.manager.save(membershipUpgrade);

          const membershipHistory = this.membershipHistoryRepository.create({
            membership: { id: membershipUpgrade.membership.id },
            action: MembershipAction.STATUS_CHANGED,
            performedBy: reviewer,
            notes: `Actualización de plan cancelada por rechazo de pago: ${rejectPaymentDto.rejectionReason}`,
            changes: {
              'Estado actual': 'Pendiente',
              'Nuevo estado': 'Cancelado',
              'Plan anterior': membershipUpgrade.fromPlan.name,
              'Plan nuevo': membershipUpgrade.toPlan.name,
            },
          });

          await queryRunner.manager.save(membershipHistory);
        }
      } else if (payment.paymentConfig.code === 'RECONSUMPTION' &&
        payment.relatedEntityType === 'membership_reconsumption') {
        await this.reconsumptionService.processReconsumptionRejection(
          payment,
          rejectPaymentDto.rejectionReason,
          queryRunner,
        );
      } else if (payment.paymentConfig.code === 'ORDER_PAYMENT' &&
        payment.relatedEntityType === 'order') {
        await this.orderPaymentService.processOrderRejection(
          payment,
          rejectPaymentDto.rejectionReason,
          queryRunner,
        );
      }

      try {
        await this.notificationFactory.paymentRejected(
          payment.user.id,
          payment.amount,
          payment.id,
          payment.rejectionReason
        );
      } catch (notificationError) {
        this.logger.error(
          `Error al enviar notificación de rechazo: ${notificationError.message}`,
          notificationError.stack,
        );
      }

      await queryRunner.commitTransaction();
      console.log("reviewerId", reviewerId);
      console.log("payment", payment);
      console.log("reviewer", reviewer);
      const response = await this.operationPaymentResponse(
        payment.user.id,
        `Pago rechazado correctamente`,
        payment,
        reviewer,
      );
      console.log("RESPONSE", response);
      return {
        ...response,
        rejectionReason: payment.rejectionReason,
      }
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

  // Payment completed
  async updateDataOrcompletePayment(
    paymentId: number,
    reviewerId: string,
    completePaymentDto: CompletePaymentDto,
  ) {
    const { codeOperation, numberTicket } = completePaymentDto;
    if (!codeOperation && !numberTicket)
      throw new BadRequestException(
        'Se requiere al menos un código de operación o número de ticket',
      );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['user', 'paymentConfig'],
      });

      if (!payment) throw new NotFoundException(`Pago con ID ${paymentId} no encontrado`);

      // if (payment.status !== PaymentStatus.APPROVED)
      //   throw new BadRequestException(`El pago tiene que estar aprobado previamente`);

      const reviewer = await this.userRepository.findOne({
        where: { id: reviewerId },
      });

      if (!reviewer)
        throw new NotFoundException(`Revisor con ID ${reviewerId} no encontrado`);

      payment.codeOperation = codeOperation || payment.codeOperation;
      payment.numberTicket = numberTicket || payment.numberTicket;

      if (payment.codeOperation && payment.numberTicket)
        payment.status = PaymentStatus.COMPLETED;

      await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();
      console.log("reviewerId", reviewerId);
      console.log("payment", payment);
      console.log("reviewer", reviewer);

      const message = await this.operationPaymentResponse(
        reviewerId,
        `Pago completado correctamente`,
        payment,
        reviewer,
      );
      console.log("MESSAGE", message);
      return message;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al aprobar pago: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async operationPaymentResponse(
    userId: string,
    message: string,
    payment: Payment,
    reviewer: User,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['personalInfo', 'contactInfo'],
    });
    console.log("user", user);
    return {
      success: true,
      message,
      paymentId: payment.id,
      user: {
        email: user.email,
        firstName: user.personalInfo.firstName,
        lastName: user.personalInfo.lastName,
        phone: user.contactInfo.phone,
      },
      reviewedBy: {
        id: reviewer.id,
        email: reviewer.email,
      },
      timestamp: payment.reviewedAt,
    };
  }
}