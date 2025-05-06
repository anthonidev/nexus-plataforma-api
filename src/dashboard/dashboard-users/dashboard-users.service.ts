import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { DashboardMembershipsService } from '../dashboard-memberships/dashboard-memberships.service';
import { DashboardPointsService } from '../dashboard-points/dashboard-points.service';
import { DashboardRanksService } from '../dashboard-ranks/dashboard-ranks.service';
import { formatUserDataResponse } from './helpers/format-user-data-response.helper';

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
