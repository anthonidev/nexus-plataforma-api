import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getCurrentMonthDates } from 'src/common/helpers/get-current-month-dates.helper';
import { MonthlyVolumeRank, MonthlyVolumeStatus } from 'src/ranks/entities/monthly_volume_ranks.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { Repository } from 'typeorm';
import { formatMonthlyVolumeUserResponse } from './helpers/format-monthly-volume-user-response.helper';
import { formatRankUserResponse } from './helpers/format-rank-user-response.helper';

@Injectable()
export class DashboardRanksService {
  private readonly logger = new Logger(DashboardRanksService.name);
  constructor(
    @InjectRepository(UserRank)
    private readonly userRankRepository: Repository<UserRank>,
    @InjectRepository(MonthlyVolumeRank)
    private readonly monthlyVolumeRepository: Repository<MonthlyVolumeRank>,
  ) {}

  async getUserRanks(userId: string) {
    try {
      const userRank = await this.userRankRepository.findOne({
        where: { user: { id: userId } },
        relations: ['currentRank', 'highestRank'],
      })
      return formatRankUserResponse(userRank);
    } catch (error) {
      throw error;
    }
  }

  async getCurrentMonthlyVolume(userId: string) {
      try {
        const dates = getCurrentMonthDates();
  
        const monthlyVolume = await this.monthlyVolumeRepository.findOne({
          where: {
            user: { id: userId },
            status: MonthlyVolumeStatus.PENDING,
            monthStartDate: dates.start,
            monthEndDate: dates.end,
          },
        });
        return formatMonthlyVolumeUserResponse(monthlyVolume);
      } catch (error) {
        this.logger.error(`Error obteniendo volumen mensual: ${error.message}`);
        return null;
      }
    }
}
