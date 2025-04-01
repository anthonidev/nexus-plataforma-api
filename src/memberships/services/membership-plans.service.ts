import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FindMembershipPlansDto } from '../dto/find-membership-plan.dto';
import { MembershipPlan } from '../entities/membership-plan.entity';

@Injectable()
export class MembershipPlansService {
  private readonly logger = new Logger(MembershipPlansService.name);

  constructor(
    @InjectRepository(MembershipPlan)
    private readonly membershipPlanRepository: Repository<MembershipPlan>,
  ) {}

  async findAll(filters: FindMembershipPlansDto = {}) {
    try {
      const queryBuilder =
        this.membershipPlanRepository.createQueryBuilder('plan');

      if (filters.isActive !== undefined) {
        queryBuilder.where('plan.isActive = :isActive', {
          isActive: filters.isActive,
        });
      }

      queryBuilder.orderBy('plan.displayOrder', 'ASC');

      queryBuilder.addOrderBy('plan.name', 'ASC');

      const plans = await queryBuilder.getMany();

      return plans;
    } catch (error) {
      this.logger.error(
        `Error al obtener planes de membresía: ${error.message}`,
      );
      throw error;
    }
  }

  async findOne(id: number) {
    try {
      const plan = await this.membershipPlanRepository.findOne({
        where: { id },
      });

      if (!plan) {
        throw new NotFoundException(
          `Plan de membresía con ID ${id} no encontrado`,
        );
      }

      return plan;
    } catch (error) {
      this.logger.error(
        `Error al obtener plan de membresía con ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }
}
