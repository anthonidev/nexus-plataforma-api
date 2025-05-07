import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { DashboardMembershipsService } from '../dashboard-memberships/dashboard-memberships.service';
import { DashboardPointsService } from '../dashboard-points/dashboard-points.service';
import { DashboardRanksService } from '../dashboard-ranks/dashboard-ranks.service';
import { formatUserDataResponse } from './helpers/format-user-data-response.helper';
import { RangeDatesDto } from 'src/common/dto/range-dates.dto';
import { getInitialMonth } from 'src/common/helpers/get-initial-month.helper';
import { getFinalDayMonth } from 'src/common/helpers/get-final-day-month.helper';

@Injectable()
export class DashboardUsersService {
  private readonly logger = new Logger(DashboardUsersService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dashboardMembershipsService: DashboardMembershipsService,
    private readonly dashboardPointsService: DashboardPointsService,
    private readonly dashboardRanksService: DashboardRanksService,
  ) {}

  // Methods for endpoints
  // REPORTE DE INFORMACION DE USUARIOS
  async getDashboardData(userId: string) {
    try {
      // Verificar si el usuario existe
      const user = await this.findOneUser(userId);
      // Obtener información de membresía activa
      const membership = await this.dashboardMembershipsService.getMemberships(userId);
      // Obtener información de puntos
      const points = await this.dashboardPointsService.getUserPoints(userId);
      // Obtener volumen semanal actual
      const weeklyVolume = await this.dashboardPointsService.getCurrentWeeklyVolume(userId);
      // Obtener volumen mensual actual
      const monthlyVolume = await this.dashboardRanksService.getCurrentMonthlyVolume(userId);
      // Obtener rango actual del usuario
      const rank = await this.dashboardRanksService.getUserRanks(userId);
      // Obtener cantidad de referidos directos
      const directReferrals = await this.getDirectReferrals(user.referralCode);
      // Obtener cantidad de usuarios en la red (debajo del usuario)
      const networkSize = await this.getNetworkSize(userId);

      // Construir respuesta
      return {
        user: formatUserDataResponse(user),
        membership,
        points,
        weeklyVolume,
        monthlyVolume,
        rank,
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
  
  // REPORTE DE TOTAL DE USUARIOS POR ESTADO
  async getTotalUsersByState() {
    try {
      const dataStatusMemmberships = await this.dashboardMembershipsService.getTotalStatusMemmberships();
      const { total, ...restDataStatusMemmberships } = dataStatusMemmberships;
      const totalDataUsers = await this.userRepository.count();
      return {
        total: totalDataUsers,
        ...restDataStatusMemmberships,
        'sin membresia': totalDataUsers - total,
      };

    } catch (error) {
      this.logger.error(
        `Error obteniendo datos del dashboard: ${error.message}`,
      );
      throw error;
    }
  }

  // REPORTE DE USUARIOS CREADOS POR FECHA
  async getUsersCreatedByDate(
    rangeDatesDto: RangeDatesDto,
  ) {
    try {
      const {
        startDate = getInitialMonth(),
        endDate = getFinalDayMonth(),
      } = rangeDatesDto;

      const result = await this.userRepository
        .createQueryBuilder('user')
        .select("TO_CHAR(user.createdAt, 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(user.id)', 'cantidad')
        .where('user.createdAt >= :startDate', { startDate })
        .andWhere('user.createdAt <= :endDate', { endDate })
        .groupBy('date')
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; cantidad: string }>();

      return result.map(item => ({
        date: item.date,
        cantidad: parseInt(item.cantidad, 10),
      }));
    } catch (error) {
      this.logger.error(`Error obteniendo usuarios creados por fecha: ${error.message}`, error.stack);
      throw error;
    }
  }

  // REPORTE DEL TOTAL USUARIOS POR RANGO
  async getTotalUsersByRange() {
    try {
      //Obtener el total de usuarios por Rango
      const usersByRank = await this.userRepository
      .createQueryBuilder('u')  // Usa 'u' como alias directamente
      .innerJoin('u.userRanks', 'ur')  // Asegúrate de que la relación en tu entidad User se llama "userRanks"
      .innerJoin('ur.currentRank', 'r')    // Asegúrate de que la relación en tu entidad UserRank se llama "rank"
      .select('r.name', 'rank')
      .addSelect('COUNT(u.id)', 'total')
      .groupBy('r.name')
      .getRawMany<{ rank: string; total: string }>();

      const rankResult: { [rank: string]: number } = {};  // Cambiado el tipo de la variable
      usersByRank.forEach(item => {
          const rankName = item.rank;
          const total = parseInt(item.total, 10);
          rankResult[rankName] = total;
      });
      return rankResult;
    } catch (error) {
      this.logger.error(`Error obteniendo total de usuarios por rango: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Internal helpers methods
  private async findOneUser(userId: string) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['personalInfo'],
      });
      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }
      return user;
    } catch (error) { 
      this.logger.error(`Error obteniendo datos del usuario: ${error.message}`);  
      throw error;        
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
          const activeMembership = await this.dashboardMembershipsService.getActiveMemberships(user.id);
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
}
