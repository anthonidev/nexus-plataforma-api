import { Injectable, Logger, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getCurrentWeekDates } from 'src/common/helpers/get-current-week-dates.helper';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { VolumeProcessingStatus, WeeklyVolume } from 'src/points/entities/weekly_volumes.entity';
import { Repository } from 'typeorm';
import { formatUserPointResponse } from './helpers/format-user-point-response.helper';
import { formatWeeklyVolumeUserResponse } from './helpers/format-weekly-volume-user-response.helper';

@Injectable()
export class DashboardPointsService {
  private readonly logger = new Logger(DashboardPointsService.name);
  constructor(
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(WeeklyVolume)
    private readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
  ) {}

  async getUserPoints(userId: string) {
    try {
      const userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: userId } },
      });
      return formatUserPointResponse(userPoints);
    } catch (error) {
      this.logger.error(
        `Error obteniendo datos del dashboard: ${error.message}`,
      );
      throw error;
    }
  }

  async getCurrentWeeklyVolume(userId: string) {
    try {
      const dates = getCurrentWeekDates();

      const weeklyVolume = await this.weeklyVolumeRepository.findOne({
        where: {
          user: { id: userId },
          status: VolumeProcessingStatus.PENDING,
          weekStartDate: dates.start,
          weekEndDate: dates.end,
        },
      });
      return formatWeeklyVolumeUserResponse(weeklyVolume);
    } catch (error) {
      this.logger.error(`Error obteniendo volumen semanal: ${error.message}`);
      return null;
    }
  }
}
