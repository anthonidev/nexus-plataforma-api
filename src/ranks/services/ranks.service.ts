import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { FindMonthlyVolumeRankDto } from '../dto/find-monthly-volume-rank.dto';
import { MonthlyVolumeRank, MonthlyVolumeStatus } from '../entities/monthly_volume_ranks.entity';
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

  ) { }

  async findAllRanks(userId: string) {
    try {

      const allRanks = await this.rankRepository.find({
        where: { isActive: true },
        order: { requiredPoints: 'ASC' },
        select: {
          id: true,
          name: true,
          requiredPoints: true,
          requiredDirects: true,
          code: true,
        },
      });

      const userRank = await this.userRankRepository.findOne({
        where: { user: { id: userId } },
        relations: ['currentRank', 'highestRank',],
        select: {
          id: true,
          currentRank: { id: true, name: true, code: true },
          highestRank: { id: true, name: true, code: true },
        }
      });

      const userInfo = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'email', 'referralCode'],
      });

      if (!userInfo) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      const leftLegDirects = await this.countDirectsInLeg(userId, 'LEFT');
      const rightLegDirects = await this.countDirectsInLeg(userId, 'RIGHT');
      const totalDirects = leftLegDirects + rightLegDirects;

      const currentMonthVolume = await this.getCurrentMonthlyVolume(userId);
      const totalVolume = currentMonthVolume ? currentMonthVolume.totalVolume : 0;

      let nextRank = null;
      let rankProgress = {
        directsProgress: 0,
        volumeProgress: 0,
        leftLegDirects,
        rightLegDirects,
        totalDirects,
        requiredDirects: 0,
        currentVolume: totalVolume,
        requiredVolume: 0,

      };

      if (userRank && userRank.currentRank) {
        const currentRankIndex = allRanks.findIndex(
          rank => rank.id === userRank.currentRank.id
        );

        if (currentRankIndex < allRanks.length - 1) {
          nextRank = allRanks[currentRankIndex + 1];

          rankProgress.requiredDirects = nextRank.requiredDirects;
          rankProgress.requiredVolume = nextRank.requiredPoints;
          rankProgress.directsProgress = Math.min(totalDirects, nextRank.requiredDirects);
          rankProgress.volumeProgress = Math.min(totalVolume, nextRank.requiredPoints);

        }
      }

      return {
        ranks: allRanks,
        userRank: userRank
          ? {
            currentRank: userRank.currentRank,
            highestRank: userRank.highestRank,
            nextRank: nextRank,
            progress: rankProgress,
          }
          : null,

      };
    } catch (error) {
      this.logger.error(`Error al obtener rangos: ${error.message}`);
      throw error;
    }
  }

  private async countDirectsInLeg(userId: string, side: 'LEFT' | 'RIGHT'): Promise<number> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'referralCode'],
        relations: ['leftChild', 'rightChild'],
      });

      if (!user || !user.referralCode) return 0;

      const rootChildId = side === 'LEFT' ? user.leftChild?.id : user.rightChild?.id;

      if (!rootChildId) return 0;

      const descendantsQuery = `
        WITH RECURSIVE descendants AS (
          -- Nodo inicial
          SELECT id FROM users WHERE id = $1
          UNION ALL
          -- Unir con todos los descendientes
          SELECT u.id 
          FROM users u
          JOIN descendants d ON 
            u.parent_id = d.id
        )
        SELECT id FROM descendants;
      `;

      const descendants = await this.userRepository.query(descendantsQuery, [rootChildId]);

      if (!descendants || descendants.length === 0) return 0;

      const descendantIds = descendants.map((d) => d.id);

      const activeMembershipsQuery = `
        SELECT COUNT(*) as count
        FROM users u
        JOIN memberships m ON m.user_id = u.id
        WHERE u.id = ANY($1) 
          AND u."referrerCode" = $2
          AND m.status = 'ACTIVE';
      `;

      const result = await this.userRepository.query(activeMembershipsQuery, [
        descendantIds,
        user.referralCode,
      ]);

      return parseInt(result[0]?.count || '0');
    } catch (error) {
      this.logger.error(
        `Error al contar directos en pierna ${side} para usuario ${userId}: ${error.message}`,
      );
      return 0;
    }
  }

  private async getCurrentMonthlyVolume(userId: string): Promise<{ totalVolume: number, leftVolume: number, rightVolume: number } | null> {
    try {
      const currentMonthVolume = await this.monthlyVolumeRankRepository.findOne({
        where: {
          user: { id: userId },
          status: MonthlyVolumeStatus.PENDING,
        },
        order: { monthStartDate: 'DESC' },
      });

      if (!currentMonthVolume) return null;

      return {
        totalVolume: currentMonthVolume.totalVolume,
        leftVolume: currentMonthVolume.leftVolume,
        rightVolume: currentMonthVolume.rightVolume,
      };
    } catch (error) {
      this.logger.error(`Error al obtener volumen mensual para usuario ${userId}: ${error.message}`);
      return null;
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