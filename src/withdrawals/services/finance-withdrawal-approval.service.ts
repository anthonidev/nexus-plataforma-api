import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Withdrawal, WithdrawalStatus } from '../entities/withdrawal.entity';

import {
  PointsTransaction,
  PointTransactionStatus,
  PointTransactionType,
} from 'src/points/entities/points_transactions.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import {
  ApproveWithdrawalDto,
  RejectWithdrawalDto,
} from '../dto/withdrawal-approval.dto';

@Injectable()
export class FinanceWithdrawalApprovalService {
  private readonly logger = new Logger(FinanceWithdrawalApprovalService.name);

  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    private readonly dataSource: DataSource,
  ) {}

  async approveWithdrawal(
    withdrawalId: number,
    reviewerId: string,
    approveWithdrawalDto: ApproveWithdrawalDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id: withdrawalId },
        relations: ['user'],
      });

      if (!withdrawal) {
        throw new NotFoundException(`Retiro con ID ${withdrawalId} no encontrado`);
      }

      if (withdrawal.status !== WithdrawalStatus.PENDING) {
        throw new BadRequestException(
          `El retiro ya ha sido ${withdrawal.status === WithdrawalStatus.APPROVED ? 'aprobado' : 'rechazado'}`,
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

      // Actualizar el estado del retiro
      withdrawal.status = WithdrawalStatus.APPROVED;
      withdrawal.reviewedBy = reviewer;
      withdrawal.reviewedAt = new Date();
      withdrawal.codeOperation = approveWithdrawalDto.codeOperation;
      withdrawal.banckNameApproval = approveWithdrawalDto.banckNameApproval;
      withdrawal.dateOperation = new Date(approveWithdrawalDto.dateOperation);
      withdrawal.numberTicket = approveWithdrawalDto.numberTicket;

      await queryRunner.manager.save(withdrawal);

      // Buscar la transacción de puntos correspondiente
      const pointsTransaction = await this.pointsTransactionRepository.findOne({
        where: {
          type: PointTransactionType.WITHDRAWAL,
          status: PointTransactionStatus.PENDING,
          metadata: {
            withdrawalId: withdrawalId.toString(),
          },
        },
      });

      if (pointsTransaction) {
        pointsTransaction.status = PointTransactionStatus.COMPLETED;
        pointsTransaction.metadata = {
          ...pointsTransaction.metadata,
          withdrawalStatus: WithdrawalStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: reviewerId,
          codeOperation: approveWithdrawalDto.codeOperation,
          numberTicket: approveWithdrawalDto.numberTicket,
        };

        await queryRunner.manager.save(pointsTransaction);
      } else {
        // Buscar de manera más flexible si no se encuentra con el método anterior
        const transactions = await this.pointsTransactionRepository.find({
          where: {
            user: { id: withdrawal.user.id },
            type: PointTransactionType.WITHDRAWAL,
            status: PointTransactionStatus.PENDING,
          },
          order: { createdAt: 'DESC' },
          take: 1,
        });

        if (transactions.length > 0) {
          const transaction = transactions[0];
          transaction.status = PointTransactionStatus.COMPLETED;
          transaction.metadata = {
            ...transaction.metadata,
            withdrawalId: withdrawalId.toString(),
            withdrawalStatus: WithdrawalStatus.APPROVED,
            approvedAt: new Date(),
            approvedBy: reviewerId,
            codeOperation: approveWithdrawalDto.codeOperation,
            numberTicket: approveWithdrawalDto.numberTicket,
          };

          await queryRunner.manager.save(transaction);
        } else {
          this.logger.warn(
            `No se encontró transacción de puntos para el retiro ${withdrawalId}`,
          );
        }
      }

      // Actualizar el campo totalWithdrawnPoints en UserPoints
      const userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: withdrawal.user.id } },
      });

      if (userPoints) {
        userPoints.totalWithdrawnPoints =
          Number(userPoints.totalWithdrawnPoints) + Number(withdrawal.amount);
        await queryRunner.manager.save(userPoints);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Retiro aprobado correctamente`,
        withdrawalId: withdrawal.id,
        reviewedBy: {
          id: reviewer.id,
          email: reviewer.email,
        },
        timestamp: withdrawal.reviewedAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al aprobar retiro: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        'Error al procesar la aprobación del retiro',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async rejectWithdrawal(
    withdrawalId: number,
    reviewerId: string,
    rejectWithdrawalDto: RejectWithdrawalDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id: withdrawalId },
        relations: ['user'],
      });

      if (!withdrawal) {
        throw new NotFoundException(`Retiro con ID ${withdrawalId} no encontrado`);
      }

      if (withdrawal.status !== WithdrawalStatus.PENDING) {
        throw new BadRequestException(
          `El retiro ya ha sido ${withdrawal.status === WithdrawalStatus.APPROVED ? 'aprobado' : 'rechazado'}`,
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

      if (!rejectWithdrawalDto.rejectionReason) {
        throw new BadRequestException(
          'Se requiere una razón para rechazar el retiro',
        );
      }

      // Actualizar el estado del retiro
      withdrawal.status = WithdrawalStatus.REJECTED;
      withdrawal.reviewedBy = reviewer;
      withdrawal.reviewedAt = new Date();
      withdrawal.rejectionReason = rejectWithdrawalDto.rejectionReason;

      await queryRunner.manager.save(withdrawal);

      // Buscar la transacción de puntos correspondiente
      const pointsTransaction = await this.pointsTransactionRepository.findOne({
        where: {
          type: PointTransactionType.WITHDRAWAL,
          status: PointTransactionStatus.PENDING,
          metadata: {
            withdrawalId: withdrawalId.toString(),
          },
        },
      });

      if (pointsTransaction) {
        pointsTransaction.status = PointTransactionStatus.CANCELLED;
        pointsTransaction.metadata = {
          ...pointsTransaction.metadata,
          withdrawalStatus: WithdrawalStatus.REJECTED,
          rejectedAt: new Date(),
          rejectedBy: reviewerId,
          rejectionReason: rejectWithdrawalDto.rejectionReason,
        };

        await queryRunner.manager.save(pointsTransaction);
      } else {
        // Buscar de manera más flexible si no se encuentra con el método anterior
        const transactions = await this.pointsTransactionRepository.find({
          where: {
            user: { id: withdrawal.user.id },
            type: PointTransactionType.WITHDRAWAL,
            status: PointTransactionStatus.PENDING,
          },
          order: { createdAt: 'DESC' },
          take: 1,
        });

        if (transactions.length > 0) {
          const transaction = transactions[0];
          transaction.status = PointTransactionStatus.CANCELLED;
          transaction.metadata = {
            ...transaction.metadata,
            withdrawalId: withdrawalId.toString(),
            withdrawalStatus: WithdrawalStatus.REJECTED,
            rejectedAt: new Date(),
            rejectedBy: reviewerId,
            rejectionReason: rejectWithdrawalDto.rejectionReason,
          };

          await queryRunner.manager.save(transaction);
        } else {
          this.logger.warn(
            `No se encontró transacción de puntos para el retiro ${withdrawalId}`,
          );
        }
      }

      // Devolver los puntos al usuario
      const userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: withdrawal.user.id } },
      });

      if (userPoints) {
        userPoints.availablePoints =
          Number(userPoints.availablePoints) + Number(withdrawal.amount);
        await queryRunner.manager.save(userPoints);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Retiro rechazado correctamente`,
        withdrawalId: withdrawal.id,
        rejectionReason: withdrawal.rejectionReason,
        reviewedBy: {
          id: reviewer.id,
          email: reviewer.email,
        },
        timestamp: withdrawal.reviewedAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al rechazar retiro: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Error al procesar el rechazo del retiro');
    } finally {
      await queryRunner.release();
    }
  }
}