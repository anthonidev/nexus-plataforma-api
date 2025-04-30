import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { NotificationFactory } from 'src/notifications/factory/notification.factory';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { RejectPaymentDto } from '../dto/approval.dto';
import { ApprovePaymentDto } from '../dto/approve-payment.dto';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { BaseApprovalService } from './base-approval.service';
import { DirectBonusService } from './direct-bonus.service';
import { MembershipPaymentService } from './membership-payment.service';
import { PlanUpgradeService } from './plan-upgrade.service';
import { ReconsumptionService } from './reconsumption.service';
import { TreeVolumeService } from './tree-volumen.service';

@Injectable()
export class FinancePaymentApprovalService extends BaseApprovalService {
  constructor(
    @InjectRepository(Payment)
    protected readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    protected readonly userRepository: Repository<User>,
    @InjectDataSource()
    protected readonly dataSource: DataSource,
    protected readonly notificationFactory: NotificationFactory,
    private readonly membershipPaymentService: MembershipPaymentService,
    private readonly planUpgradeService: PlanUpgradeService,
    private readonly reconsumptionService: ReconsumptionService,
    private readonly directBonusService: DirectBonusService,
    private readonly treeVolumeService: TreeVolumeService
  ) {
    super(
      paymentRepository,
      userRepository,
      null, // membershipRepository
      null, // membershipPlanRepository
      null, // membershipHistoryRepository
      null, // userPointsRepository
      null, // pointsTransactionRepository
      null, // weeklyVolumeRepository
      null, // membershipUpgradeRepository
      null, // reconsumptionRepository
      null, // rankRepository
      null, // userRankRepository
      null, // monthlyVolumeRankRepository
      notificationFactory,
      dataSource
    );
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
        default:
          this.logger.warn(
            `Tipo de pago desconocido: ${payment.paymentConfig.code}`,
          );
      }

      await this.notificationFactory.paymentApproved(
        payment.user.id,
        payment.amount,
        payment.id,
        payment.paymentConfig.name
      );

      await queryRunner.commitTransaction();

      const user = await this.userRepository.findOne({
        where: { id: payment.user.id },
        relations: ['personalInfo', 'contactInfo'],
      });

      return {
        success: true,
        message: `Pago aprobado correctamente`,
        user: {
          email: user.email,
          firstName: user.personalInfo.firstName,
          lastName: user.personalInfo.lastName,
          phone: user.contactInfo.phone,
        },
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

      if (payment.paymentConfig.code === 'RECONSUMPTION') {
        await this.reconsumptionService.processReconsumptionRejection(
          payment,
          rejectPaymentDto.rejectionReason,
          queryRunner,
        );
      }

      await this.notificationFactory.paymentRejected(
        payment.user.id,
        payment.amount,
        payment.id,
        payment.rejectionReason
      );

      await queryRunner.commitTransaction();

      const user = await this.userRepository.findOne({
        where: { id: payment.user.id },
        relations: ['personalInfo', 'contactInfo'],
      });

      return {
        success: true,
        message: `Pago rechazado correctamente`,
        paymentId: payment.id,
        user: {
          email: user.email,
          firstName: user.personalInfo.firstName,
          lastName: user.personalInfo.lastName,
          phone: user.contactInfo.phone,
        },
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
}