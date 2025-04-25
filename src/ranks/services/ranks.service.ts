import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { User } from 'src/user/entities/user.entity';
import { getFirstDayOfWeek, getLastDayOfWeek } from 'src/utils/dates';
import { Repository } from 'typeorm';
import { FindMonthlyVolumeRankDto } from '../dto/find-monthly-volume-rank.dto';
import { MonthlyVolumeRank } from '../entities/monthly_volume_ranks.entity';
import { Rank } from '../entities/ranks.entity';
import { UserRank } from '../entities/user_ranks.entity';

@Injectable()
export class RanksService {
  private readonly logger = new Logger(RanksService.name);

  constructor(
    @InjectRepository(Rank)
    private readonly rankRepository: Repository<Rank>,
    @InjectRepository(UserRank)
    private readonly userRankRepository: Repository<UserRank>,
    @InjectRepository(MonthlyVolumeRank)
    private readonly monthlyVolumeRankRepository: Repository<MonthlyVolumeRank>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAllRanks(userId: string) {
    try {
      const date = new Date();
      const firstDay = getFirstDayOfWeek(date);
      const lastDay = getLastDayOfWeek(date);
      console.log('firstDay', firstDay);
      console.log('lastDay', lastDay);
      const allRanks = await this.rankRepository.find({
        where: { isActive: true },
        order: { requiredPoints: 'ASC' },
      });

      const userRank = await this.userRankRepository.findOne({
        where: { user: { id: userId } },
        relations: ['currentRank', 'highestRank', 'membershipPlan'],
      });

      const userInfo = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'email'],
      });

      if (!userInfo) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      return {
        ranks: allRanks,
        userRank: userRank
          ? {
              currentRank: userRank.currentRank,
              highestRank: userRank.highestRank,
              membershipPlan: userRank.membershipPlan
                ? {
                    id: userRank.membershipPlan.id,
                    name: userRank.membershipPlan.name,
                  }
                : null,
            }
          : null,
        userInfo: {
          id: userInfo.id,
          email: userInfo.email,
        },
      };
    } catch (error) {
      this.logger.error(`Error al obtener rangos: ${error.message}`);
      throw error;
    }
  }

  async getMonthlyVolumes(userId: string, filters: FindMonthlyVolumeRankDto) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        order = 'DESC',
      } = filters;

      const queryBuilder = this.monthlyVolumeRankRepository
        .createQueryBuilder('monthlyVolume')
        .leftJoinAndSelect('monthlyVolume.assignedRank', 'assignedRank')
        .where('monthlyVolume.user.id = :userId', { userId });

      if (status) {
        queryBuilder.andWhere('monthlyVolume.status = :status', { status });
      }

      if (startDate) {
        queryBuilder.andWhere('monthlyVolume.monthStartDate >= :startDate', {
          startDate: new Date(startDate),
        });
      }

      if (endDate) {
        queryBuilder.andWhere('monthlyVolume.monthEndDate <= :endDate', {
          endDate: new Date(endDate),
        });
      }

      queryBuilder
        .orderBy('monthlyVolume.monthStartDate', order)
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
        `Error al obtener volúmenes mensuales: ${error.message}`,
      );
      throw error;
    }
  }
}
