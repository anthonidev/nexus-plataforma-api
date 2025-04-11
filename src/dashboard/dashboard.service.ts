import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import {
  WeeklyVolume,
  VolumeProcessingStatus,
} from 'src/points/entities/weekly_volumes.entity';
import {
  MonthlyVolumeRank,
  MonthlyVolumeStatus,
} from 'src/ranks/entities/monthly_volume_ranks.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(WeeklyVolume)
    private readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
    @InjectRepository(MonthlyVolumeRank)
    private readonly monthlyVolumeRepository: Repository<MonthlyVolumeRank>,
    @InjectRepository(UserRank)
    private readonly userRankRepository: Repository<UserRank>,
  ) {}

  async getDashboardData(userId: string) {
    try {
      // Verificar si el usuario existe
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['personalInfo'],
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      // Obtener información de membresía activa
      const membership = await this.membershipRepository.findOne({
        where: {
          user: { id: userId },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      // Obtener información de puntos
      const userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: userId } },
      });

      // Obtener volumen semanal actual
      const weeklyVolume = await this.getCurrentWeeklyVolume(userId);

      // Obtener volumen mensual actual
      const monthlyVolume = await this.getCurrentMonthlyVolume(userId);

      // Obtener rango actual del usuario
      const userRank = await this.userRankRepository.findOne({
        where: { user: { id: userId } },
        relations: ['currentRank', 'highestRank'],
      });

      // Obtener cantidad de referidos directos
      const directReferrals = await this.getDirectReferrals(user.referralCode);

      // Obtener cantidad de usuarios en la red (debajo del usuario)
      const networkSize = await this.getNetworkSize(userId);

      // Construir respuesta
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.personalInfo
            ? `${user.personalInfo.firstName} ${user.personalInfo.lastName}`
            : null,
          referralCode: user.referralCode,
          photo: user.photo,
        },
        membership: membership
          ? {
              id: membership.id,
              plan: {
                id: membership.plan.id,
                name: membership.plan.name,
                price: membership.plan.price,
                binaryPoints: membership.plan.binaryPoints,
              },
              startDate: membership.startDate,
              endDate: membership.endDate,
              nextReconsumptionDate: membership.nextReconsumptionDate,
              autoRenewal: membership.autoRenewal,
            }
          : null,
        points: userPoints
          ? {
              availablePoints: userPoints.availablePoints,
              totalEarnedPoints: userPoints.totalEarnedPoints,
              totalWithdrawnPoints: userPoints.totalWithdrawnPoints,
            }
          : {
              availablePoints: 0,
              totalEarnedPoints: 0,
              totalWithdrawnPoints: 0,
            },
        weeklyVolume: weeklyVolume
          ? {
              leftVolume: weeklyVolume.leftVolume,
              rightVolume: weeklyVolume.rightVolume,
              total:
                Number(weeklyVolume.leftVolume) +
                Number(weeklyVolume.rightVolume),
              weekStartDate: weeklyVolume.weekStartDate,
              weekEndDate: weeklyVolume.weekEndDate,
            }
          : null,
        monthlyVolume: monthlyVolume
          ? {
              leftVolume: monthlyVolume.leftVolume,
              rightVolume: monthlyVolume.rightVolume,
              totalVolume: monthlyVolume.totalVolume,
              leftDirects: monthlyVolume.leftDirects,
              rightDirects: monthlyVolume.rightDirects,
              totalDirects:
                (monthlyVolume.leftDirects || 0) +
                (monthlyVolume.rightDirects || 0),
              monthStartDate: monthlyVolume.monthStartDate,
              monthEndDate: monthlyVolume.monthEndDate,
            }
          : null,
        rank: userRank
          ? {
              current: {
                id: userRank.currentRank.id,
                name: userRank.currentRank.name,
                code: userRank.currentRank.code,
                requiredPoints: userRank.currentRank.requiredPoints,
                requiredDirects: userRank.currentRank.requiredDirects,
              },
              highest: userRank.highestRank
                ? {
                    id: userRank.highestRank.id,
                    name: userRank.highestRank.name,
                    code: userRank.highestRank.code,
                    requiredPoints: userRank.highestRank.requiredPoints,
                    requiredDirects: userRank.highestRank.requiredDirects,
                  }
                : null,
            }
          : null,
        network: {
          directReferrals: directReferrals,
          networkSize: networkSize,
          leftLegCount: directReferrals.leftCount,
          rightLegCount: directReferrals.rightCount,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error obteniendo datos del dashboard: ${error.message}`,
      );
      throw error;
    }
  }

  private async getCurrentWeeklyVolume(userId: string) {
    try {
      const dates = this.getCurrentWeekDates();

      return await this.weeklyVolumeRepository.findOne({
        where: {
          user: { id: userId },
          status: VolumeProcessingStatus.PENDING,
          weekStartDate: dates.start,
          weekEndDate: dates.end,
        },
      });
    } catch (error) {
      this.logger.error(`Error obteniendo volumen semanal: ${error.message}`);
      return null;
    }
  }

  private async getCurrentMonthlyVolume(userId: string) {
    try {
      const dates = this.getCurrentMonthDates();

      return await this.monthlyVolumeRepository.findOne({
        where: {
          user: { id: userId },
          status: MonthlyVolumeStatus.PENDING,
          monthStartDate: dates.start,
          monthEndDate: dates.end,
        },
      });
    } catch (error) {
      this.logger.error(`Error obteniendo volumen mensual: ${error.message}`);
      return null;
    }
  }

  private async getDirectReferrals(referralCode: string) {
    try {
      const directUsers = await this.userRepository.find({
        where: { referrerCode: referralCode },
        select: ['id', 'position'],
      });

      const activeDirectUsers = await Promise.all(
        directUsers.map(async (user) => {
          const activeMembership = await this.membershipRepository.findOne({
            where: {
              user: { id: user.id },
              status: MembershipStatus.ACTIVE,
            },
          });
          return {
            ...user,
            isActive: !!activeMembership,
            position: user.position,
          };
        }),
      );

      const active = activeDirectUsers.filter((u) => u.isActive);
      const totalCount = directUsers.length;
      const activeCount = active.length;
      const leftCount = active.filter((u) => u.position === 'LEFT').length;
      const rightCount = active.filter((u) => u.position === 'RIGHT').length;

      return {
        totalCount,
        activeCount,
        leftCount,
        rightCount,
      };
    } catch (error) {
      this.logger.error(
        `Error obteniendo referidos directos: ${error.message}`,
      );
      return { totalCount: 0, activeCount: 0, leftCount: 0, rightCount: 0 };
    }
  }

  private async getNetworkSize(userId: string) {
    try {
      // Consulta recursiva para obtener todos los descendientes
      const networkQuery = `
        WITH RECURSIVE user_tree AS (
          SELECT id, parent_id, left_child_id, right_child_id, position
          FROM users
          WHERE id = $1
          UNION ALL
          SELECT u.id, u.parent_id, u.left_child_id, u.right_child_id, u.position
          FROM users u
          JOIN user_tree ut ON ut.left_child_id = u.id OR ut.right_child_id = u.id
        )
        SELECT COUNT(*) as network_size
        FROM user_tree
        WHERE id != $1;
      `;

      const result = await this.userRepository.query(networkQuery, [userId]);
      return parseInt(result[0]?.network_size || '0', 10);
    } catch (error) {
      this.logger.error(`Error obteniendo tamaño de red: ${error.message}`);
      return 0;
    }
  }

  private getCurrentWeekDates(): { start: Date; end: Date } {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = domingo, 1 = lunes, etc.

    // Calcular fecha de inicio (lunes) de la semana actual
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setHours(0, 0, 0, 0);

    // Calcular fecha de fin (domingo) de la semana actual
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: monday,
      end: sunday,
    };
  }

  private getCurrentMonthDates(): { start: Date; end: Date } {
    const today = new Date();

    // Primer día del mes actual
    const firstDayCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
    firstDayCurrentMonth.setHours(0, 0, 0, 0);

    // Último día del mes actual
    const lastDayCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );
    lastDayCurrentMonth.setHours(23, 59, 59, 999);

    return {
      start: firstDayCurrentMonth,
      end: lastDayCurrentMonth,
    };
  }
}
