import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { User } from 'src/user/entities/user.entity';
import { UserPoints } from '../entities/user_points.entity';
import { PointsTransaction } from '../entities/points_transactions.entity';
import { WeeklyVolume } from '../entities/weekly_volumes.entity';
import {
  FindPointsTransactionDto,
  FindWeeklyVolumeDto,
} from '../dto/find-weekly-volume.dto';

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
  ) {}

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
}
