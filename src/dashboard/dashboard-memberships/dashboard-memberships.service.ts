import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Membership, MembershipStatus } from 'src/memberships/entities/membership.entity';
import { Repository } from 'typeorm';
import { formatMembershipUserResponse } from './helpers/format-membership-user-response-helper';
import { GetMembershipsByDayDto } from './dto/get-memberships-by-day.dto';
import { getFinalDayMonth } from 'src/common/helpers/get-final-day-month.helper';
import { getInitialMonth } from 'src/common/helpers/get-initial-month.helper';

@Injectable()
export class DashboardMembershipsService {
  private readonly logger = new Logger(DashboardMembershipsService.name);
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}

  // REPORTE DE MEMBRESIA POR DIA
  async getMembershipsByDay(
    getMembershipsByDayDto: GetMembershipsByDayDto,
  ) {
    try {
      const {
        startDate = getInitialMonth(),
        endDate = getFinalDayMonth()
      } = getMembershipsByDayDto;
      const paymentsData = await this.membershipRepository.query(`
        WITH DateSeries AS (
          SELECT generate_series(
            '${startDate}'::date,
            '${endDate}'::date,
            '1 day'::interval
          )::date AS dt
        ),
        AllPlans AS (
          SELECT "name" AS plan FROM membership_plans
        )
        SELECT
          ds.dt AS fecha,
          ap.plan,
          COALESCE(COUNT(p.id), 0) AS count
        FROM DateSeries ds
        CROSS JOIN AllPlans ap
        LEFT JOIN payments p ON DATE(p."updatedAt") = ds.dt
        AND EXISTS (
          SELECT 1
          FROM memberships m
          INNER JOIN membership_plans mp ON m.plan_id = mp.id
          WHERE p."relatedEntityId" = m.id
            AND mp."name" = ap.plan
        )
        AND p.status = 'APPROVED'
        AND p."relatedEntityType" = 'membership'
        GROUP BY ds.dt, ap.plan
        ORDER BY ds.dt, ap.plan;
      `);

      const formattedData = {};

      paymentsData.forEach(item => {
        const date = item.fecha.toISOString().split('T')[0];
        if (!formattedData[date]) {
          formattedData[date] = { date: date };
        }
        formattedData[date][item.plan] = parseInt(item.count, 10);
      });
    
      const result = Object.values(formattedData);
      return result;
    } catch (error) {
      throw error;
    }
  }
  
  async getMemberships(userId: string) {
    try {
      const membership = await this.membershipRepository.findOne({
        where: {
          user: { id: userId },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });
      return formatMembershipUserResponse(membership);
    } catch (error) {
      this.logger.error(
        `Error obteniendo datos del dashboard: ${error.message}`,
      );
      throw error;
    }
  }

  async getActiveMemberships(userId: string) {
    try {
      const activeMembership = await this.membershipRepository.findOne({
        where: {
          user: { id: userId },
          status: MembershipStatus.ACTIVE,
        },
      });
      return activeMembership;
    } catch (error) {
      this.logger.error(
        `Error obteniendo datos del dashboard: ${error.message}`,
      );
      throw error;
    }
  }

}
