import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Membership, MembershipStatus } from 'src/memberships/entities/membership.entity';
import { Repository } from 'typeorm';
import { formatMembershipUserResponse } from './helpers/format-membership-user-response-helper';

@Injectable()
export class DashboardMembershipsService {
  private readonly logger = new Logger(DashboardMembershipsService.name);
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}
  
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
