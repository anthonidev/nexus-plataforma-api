import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FindMembershipPlansDto } from '../dto/find-membership-plan.dto';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { Membership, MembershipStatus } from '../entities/membership.entity';
import { User } from 'src/user/entities/user.entity';
import { UserMembershipInfo } from '../interfaces/MembershipResponse.interface';

@Injectable()
export class MembershipPlansService {
  private readonly logger = new Logger(MembershipPlansService.name);

  constructor(
    @InjectRepository(MembershipPlan)
    private readonly membershipPlanRepository: Repository<MembershipPlan>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(filters: FindMembershipPlansDto = {}, userId: string) {
    try {
      // 1. Buscar la información de membresía del usuario
      const userMembershipInfo = await this.getUserMembershipInfo(userId);

      // 2. Construir la consulta base
      const queryBuilder =
        this.membershipPlanRepository.createQueryBuilder('plan');

      // 3. Aplicar filtros básicos
      if (filters.isActive !== undefined) {
        queryBuilder.where('plan.isActive = :isActive', {
          isActive: filters.isActive,
        });
      } else {
        // Por defecto, mostrar solo planes activos
        queryBuilder.where('plan.isActive = :isActive', { isActive: true });
      }

      // 4. Aplicar filtros basados en la membresía actual del usuario
      if (
        userMembershipInfo.hasMembership &&
        userMembershipInfo.status === MembershipStatus.ACTIVE
      ) {
        // Si el usuario tiene una membresía activa, no mostrar planes de menor valor
        queryBuilder.andWhere('plan.price > :currentPrice', {
          currentPrice: userMembershipInfo.plan.price,
        });

        // No incluir el plan actual
        queryBuilder.andWhere('plan.id != :currentPlanId', {
          currentPlanId: userMembershipInfo.plan.id,
        });
      }

      // 5. Ordenar los resultados
      queryBuilder.orderBy('plan.displayOrder', 'ASC');
      queryBuilder.addOrderBy('plan.name', 'ASC');

      // 6. Obtener los planes filtrados
      let plans: any = await queryBuilder.getMany();

      // 7. Si el usuario tiene una membresía activa, calcular el precio de actualización
      if (
        userMembershipInfo.hasMembership &&
        userMembershipInfo.status === MembershipStatus.ACTIVE
      ) {
        plans = plans.map((plan) => {
          const upgradeCost = plan.price - userMembershipInfo.plan.price;
          return {
            ...plan,
            upgradeCost: Math.max(0, upgradeCost), // Asegurar que nunca sea negativo
            isUpgrade: true,
          };
        });
      }

      // 8. Retornar el resultado con la información de la membresía actual
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
      // 1. Buscar la información de membresía del usuario
      const userMembershipInfo = await this.getUserMembershipInfo(userId);

      // 2. Buscar el plan solicitado
      const plan = await this.membershipPlanRepository.findOne({
        where: { id },
      });

      if (!plan) {
        throw new NotFoundException(
          `Plan de membresía con ID ${id} no encontrado`,
        );
      }

      // 3. Si el usuario tiene una membresía activa, calcular el costo de actualización
      let result = { ...plan };

      if (
        userMembershipInfo.hasMembership &&
        userMembershipInfo.status === MembershipStatus.ACTIVE
      ) {
        const upgradeCost = plan.price - userMembershipInfo.plan.price;
        // Si el plan solicitado es de menor valor, advertir
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

  /**
   * Obtiene la información de la membresía actual del usuario
   */
  private async getUserMembershipInfo(
    userId: string,
  ): Promise<UserMembershipInfo> {
    // Verificar que el usuario existe
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Buscar la membresía más reciente del usuario
    const membership = await this.membershipRepository.findOne({
      where: { user: { id: userId } },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    // Si no tiene membresía
    if (!membership) {
      return {
        hasMembership: false,
        message: 'El usuario no tiene ninguna membresía.',
      };
    }

    // Construir respuesta según el estado de la membresía
    const response: UserMembershipInfo = {
      hasMembership: true,
      status: membership.status,
      plan: {
        id: membership.plan.id,
        name: membership.plan.name,
        price: membership.plan.price,
      },
      nextReconsumptionDate: membership.nextReconsumptionDate,
      endDate: membership.endDate,
    };

    // Agregar mensaje según el estado
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
