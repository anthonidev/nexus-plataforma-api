// src/points/services/points.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import {
  FindPointsTransactionDto,
  FindWeeklyVolumeDto,
} from '../dto/find-weekly-volume.dto';
import { PointsTransaction } from '../entities/points_transactions.entity';
import { UserPoints } from '../entities/user_points.entity';
import { WeeklyVolume } from '../entities/weekly_volumes.entity';
import { PointsEventsService } from './points-events.service';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { T } from '@faker-js/faker/dist/airline-CBNP41sR';
import { Payment } from 'src/payments/entities/payment.entity';
import { PointsTransactionPayment } from '../entities/points-transactions-payments.entity';
import { WeeklyVolumesHistory } from '../entities/weekly-volumes-history.entity';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(WeeklyVolume)
    private readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly pointsEventsService: PointsEventsService,
  ) { }

  async getUserPoints(userId: string) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      let userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: userId } },
        relations: ['membershipPlan'],
      });

      if (!userPoints) {
        userPoints = this.userPointsRepository.create({
          user: { id: userId },
          availablePoints: 0,
          totalEarnedPoints: 0,
          totalWithdrawnPoints: 0,
        });

        await this.userPointsRepository.save(userPoints);
      }

      // Emit points update event
      await this.pointsEventsService.emitPointsUpdate(userId);

      return {
        availablePoints: userPoints.availablePoints,
        totalEarnedPoints: userPoints.totalEarnedPoints,
        totalWithdrawnPoints: userPoints.totalWithdrawnPoints,
        membershipPlan: userPoints.membershipPlan
          ? {
            name: userPoints.membershipPlan.name,
          }
          : null,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener puntos del usuario: ${error.message}`,
      );
      throw error;
    }
  }

  async getPointsTransactions(
    userId: string,
    filters: FindPointsTransactionDto,
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        status,
        startDate,
        endDate,
        order = 'DESC',
      } = filters;

      const queryBuilder = this.pointsTransactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.user.id = :userId', { userId });

      if (type) {
        queryBuilder.andWhere('transaction.type = :type', { type });
      }

      if (status) {
        queryBuilder.andWhere('transaction.status = :status', { status });
      }

      if (startDate) {
        queryBuilder.andWhere('transaction.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        queryBuilder.andWhere('transaction.createdAt <= :endDate', {
          endDate: endOfDay,
        });
      }

      queryBuilder
        .orderBy('transaction.createdAt', order)
        .skip((page - 1) * limit)
        .take(limit);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      return PaginationHelper.createPaginatedResponse(
        items,
        totalItems,
        filters,
      );
    } catch (error) {
      this.logger.error(
        `Error al obtener transacciones de puntos: ${error.message}`,
      );
      throw error;
    }
  }

  async getPointsTransactionDetails(
    id: number,
    paginationDto: PaginationDto,
  ) {
    const getPointsTransactionDetails = await this.pointsTransactionRepository.findOne({
      where: { id },
      relations: [
        'pointsTransactionsPayments',
        'pointsTransactionsPayments.payment',
      ],
    });
    if (!getPointsTransactionDetails)
      throw new NotFoundException(`Transacción de puntos con ID ${id} no encontrada`);
    const { pointsTransactionsPayments, ...restData } = getPointsTransactionDetails;
    const pointsTransactionsPaymentsDetails = await this.paymentDetails(pointsTransactionsPayments);
    return {
      ...restData,
      listPayments: PaginationHelper.createPaginatedResponse(
        pointsTransactionsPaymentsDetails,
        pointsTransactionsPaymentsDetails.length,
        paginationDto,
      ),
    }
  }

  async getWeeklyVolumes(userId: string, filters: FindWeeklyVolumeDto) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        order = 'DESC',
      } = filters;

      const queryBuilder = this.weeklyVolumeRepository
        .createQueryBuilder('weeklyVolume')
        .where('weeklyVolume.user.id = :userId', { userId });

      if (status) {
        queryBuilder.andWhere('weeklyVolume.status = :status', { status });
      }

      if (startDate) {
        queryBuilder.andWhere('weeklyVolume.weekStartDate >= :startDate', {
          startDate: new Date(startDate),
        });
      }

      if (endDate) {
        queryBuilder.andWhere('weeklyVolume.weekEndDate <= :endDate', {
          endDate: new Date(endDate),
        });
      }

      queryBuilder
        .orderBy('weeklyVolume.weekStartDate', order)
        .skip((page - 1) * limit)
        .take(limit);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      return PaginationHelper.createPaginatedResponse(
        items,
        totalItems,
        filters,
      );
    } catch (error) {
      this.logger.error(
        `Error al obtener volúmenes semanales: ${error.message}`,
      );
      throw error;
    }
  }

  async getWeeklyVolumeDetails(id: number, paginationDto: PaginationDto) {
    const getWeeklyVolumeDetails = await this.weeklyVolumeRepository.findOne({
      where: { id },
      relations: ['history', 'history.payment'],
    });
    if (!getWeeklyVolumeDetails)
      throw new NotFoundException(`Volumen semanal con ID ${id} no encontrada`);
    const { history, ...restData } = getWeeklyVolumeDetails;
    const historyDetails = await this.paymentDetails(history);
    return {
      ...restData,
      weeklyVolumesHistory: PaginationHelper.createPaginatedResponse(
        historyDetails,
        historyDetails.length,
        paginationDto,
      ),
    }
  }

  // This is a utility method to update points and emit the update event
  async updateUserPoints(userId: string, updatedData: Partial<UserPoints>) {
    try {
      let userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: userId } },
        relations: ['membershipPlan'],
      });

      if (!userPoints) {
        userPoints = this.userPointsRepository.create({
          user: { id: userId },
          availablePoints: 0,
          totalEarnedPoints: 0,
          totalWithdrawnPoints: 0,
          ...updatedData,
        });
      } else {
        this.userPointsRepository.merge(userPoints, updatedData);
      }

      const savedPoints = await this.userPointsRepository.save(userPoints);

      // Emit points update event
      await this.pointsEventsService.emitPointsUpdate(userId);

      return savedPoints;
    } catch (error) {
      this.logger.error(
        `Error al actualizar puntos del usuario: ${error.message}`,
      );
      throw error;
    }
  }

  private async paymentDetails(
    entity: PointsTransactionPayment[] | WeeklyVolumesHistory[]
  ) {
    return entity.map(item => {
      const { payment, ...restData } = item;
      return {
        ...restData,
        payment: {
          id: payment.id,
          amount: payment.amount,
          methodPayment: payment.methodPayment,
          codeOperation: payment.codeOperation,
          banckName: payment.banckName,
          dateOperation: payment.dateOperation,
          numberTicket: payment.numberTicket,
          status: payment.status,
        },
      };
    });
  }
}