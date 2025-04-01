import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { FindMembershipPlansDto } from '../dto/find-membership-plan.dto';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { Membership, MembershipStatus } from '../entities/membership.entity';
import {
  MembershipUpgrade,
  UpgradeStatus,
} from '../entities/membership_upgrades.entity';
import { UserMembershipInfo } from '../interfaces/MembershipResponse.interface';

@Injectable()
export class MembershipPlansService {
  private readonly logger = new Logger(MembershipPlansService.name);

  constructor(
    @InjectRepository(MembershipPlan)
    private readonly membershipPlanRepository: Repository<MembershipPlan>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipUpgrade)
    private readonly membershipUpgradeRepository: Repository<MembershipUpgrade>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}
  async findAll(filters: FindMembershipPlansDto = {}, userId: string) {
    try {
      const userMembershipInfo = await this.getUserMembershipInfo(userId);

      if (userMembershipInfo.hasMembership) {
        const pendingUpgrade = await this.membershipUpgradeRepository.findOne({
          where: {
            membership: { id: userMembershipInfo.membershipId },
            status: UpgradeStatus.PENDING,
          },
          relations: ['toPlan'],
        });

        if (pendingUpgrade) {
          userMembershipInfo.pendingUpgrade = {
            id: pendingUpgrade.id,
            toPlan: {
              id: pendingUpgrade.toPlan.id,
              name: pendingUpgrade.toPlan.name,
            },
            upgradeCost: pendingUpgrade.upgradeCost,
            status: pendingUpgrade.status,
          };
        }
      }

      const queryBuilder =
        this.membershipPlanRepository.createQueryBuilder('plan');

      if (filters.isActive !== undefined) {
        queryBuilder.where('plan.isActive = :isActive', {
          isActive: filters.isActive,
        });
      } else {
        queryBuilder.where('plan.isActive = :isActive', { isActive: true });
      }

      if (
        userMembershipInfo.hasMembership &&
        userMembershipInfo.status === MembershipStatus.ACTIVE
      ) {
        queryBuilder.andWhere('plan.price > :currentPrice', {
          currentPrice: userMembershipInfo.plan.price,
        });

        queryBuilder.andWhere('plan.id != :currentPlanId', {
          currentPlanId: userMembershipInfo.plan.id,
        });

        if (userMembershipInfo.pendingUpgrade) {
          queryBuilder.andWhere('plan.id != :pendingPlanId', {
            pendingPlanId: userMembershipInfo.pendingUpgrade.toPlan.id,
          });
        }
      }

      queryBuilder.orderBy('plan.displayOrder', 'ASC');
      queryBuilder.addOrderBy('plan.name', 'ASC');

      let plans: any = await queryBuilder.getMany();

      if (
        userMembershipInfo.hasMembership &&
        userMembershipInfo.status === MembershipStatus.ACTIVE
      ) {
        plans = plans.map((plan) => {
          const upgradeCost = plan.price - userMembershipInfo.plan.price;
          return {
            ...plan,
            upgradeCost: Math.max(0, upgradeCost),
            isUpgrade: true,
          };
        });
      }

      return {
        plans,
        userMembership: userMembershipInfo,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener planes de membresía: ${error.message}`,
      );
      throw error;
    }
  }
  async findOne(id: number, userId: string) {
    try {
      const userMembershipInfo = await this.getUserMembershipInfo(userId);

      const plan = await this.membershipPlanRepository.findOne({
        where: { id },
      });

      if (!plan) {
        throw new NotFoundException(
          `Plan de membresía con ID ${id} no encontrado`,
        );
      }

      let result = { ...plan };

      if (
        userMembershipInfo.hasMembership &&
        userMembershipInfo.status === MembershipStatus.ACTIVE
      ) {
        const upgradeCost = plan.price - userMembershipInfo.plan.price;
        if (plan.price <= userMembershipInfo.plan.price) {
          result['warning'] =
            'Este plan es de igual o menor valor que tu plan actual. No es recomendable cambiar.';
        }
        result['upgradeCost'] = Math.max(0, upgradeCost);
        result['isUpgrade'] = true;
      }

      return {
        plan: result,
        userMembership: userMembershipInfo,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener plan de membresía con ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  private async getUserMembershipInfo(
    userId: string,
  ): Promise<UserMembershipInfo> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const membership = await this.membershipRepository.findOne({
      where: { user: { id: userId } },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    if (!membership) {
      return {
        hasMembership: false,
        message: 'El usuario no tiene ninguna membresía.',
      };
    }

    const response: UserMembershipInfo = {
      hasMembership: true,
      membershipId: membership.id,
      status: membership.status,
      plan: {
        id: membership.plan.id,
        name: membership.plan.name,
        price: membership.plan.price,
      },
      nextReconsumptionDate: membership.nextReconsumptionDate,
      endDate: membership.endDate,
    };

    switch (membership.status) {
      case MembershipStatus.PENDING:
        response.message =
          'Tienes una solicitud de membresía pendiente de aprobación.';
        break;
      case MembershipStatus.ACTIVE:
        response.message = 'Tu membresía está activa.';
        break;
      case MembershipStatus.EXPIRED:
        response.message = 'Tu membresía ha expirado. Considera renovarla.';
        break;
      case MembershipStatus.INACTIVE:
        response.message =
          'Tu membresía está inactiva. Contacta a soporte para más información.';
        break;
    }

    return response;
  }
}
