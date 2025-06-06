import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/dto/paginationDto';
import {
  PaginatedResult,
  PaginationHelper,
} from 'src/common/helpers/pagination.helper';
import { Repository } from 'typeorm';
import { MembershipHistory } from '../entities/membership_history.entity';
import { Membership, MembershipStatus } from '../entities/membership.entity';
import {
  MembershipReconsumption,
  ReconsumptionStatus,
} from '../entities/membership-recosumption.entity';

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(MembershipReconsumption)
    private readonly reconsumptionRepository: Repository<MembershipReconsumption>,
  ) {}

  async getMembershipHistory(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<MembershipHistory>> {
    try {
      const { page = 1, limit = 10, order = 'DESC' } = paginationDto;

      // Primero obtenemos la membresía activa del usuario
      const membership = await this.membershipRepository.findOne({
        where: { user: { id: userId } },
        relations: ['plan'],
        order: { createdAt: 'DESC' },
      });

      if (!membership) {
        throw new NotFoundException('El usuario no tiene una membresía');
      }

      const queryBuilder = this.membershipHistoryRepository
        .createQueryBuilder('history')
        .leftJoinAndSelect('history.membership', 'membership')
        .where('membership.id = :membershipId', { membershipId: membership.id })
        .orderBy('history.createdAt', order)
        .skip((page - 1) * limit)
        .take(limit);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      return PaginationHelper.createPaginatedResponse(
        items,
        totalItems,
        paginationDto,
      );
    } catch (error) {
      this.logger.error(
        `Error obteniendo historial de membresía: ${error.message}`,
      );
      throw error;
    }
  }

  async getReconsumptions(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<
    PaginatedResult<MembershipReconsumption> & {
      canReconsume: boolean;
      autoRenewal: boolean;
      reconsumptionAmount: number;
    }
  > {
    try {
      const { page = 1, limit = 10, order = 'DESC' } = paginationDto;

      // Primero obtenemos la membresía activa del usuario
      const membership = await this.membershipRepository.findOne({
        where: { user: { id: userId }, status: MembershipStatus.ACTIVE },
        relations: ['plan'],
      });

      if (!membership) {
        throw new NotFoundException('El usuario no tiene una membresía activa');
      }

      const queryBuilder = this.reconsumptionRepository
        .createQueryBuilder('reconsumption')
        .leftJoinAndSelect('reconsumption.membership', 'membership')
        .where('membership.id = :membershipId', { membershipId: membership.id })
        .orderBy('reconsumption.createdAt', order)
        .skip((page - 1) * limit)
        .take(limit);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      const pendingReconsumption = await this.reconsumptionRepository.findOne({
        where: {
          membership: { id: membership.id },
          status: ReconsumptionStatus.PENDING,
        },
      });

      const nextReconsumptionDate = new Date(membership.endDate);
      const canReconsume =
        !pendingReconsumption && new Date() >= nextReconsumptionDate;

      const autoRenewal = membership.autoRenewal;
      const reconsumptionAmount = membership.minimumReconsumptionAmount;

      return {
        ...PaginationHelper.createPaginatedResponse(
          items,
          totalItems,
          paginationDto,
        ),
        autoRenewal,
        canReconsume,
        reconsumptionAmount,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo reconsumos: ${error.message}`);
      throw error;
    }
  }

  async getMembershipDetail(userId: string) {
    try {
      const membership = await this.membershipRepository.findOne({
        where: {
          user: { id: userId },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan', 'user'],
      });

      if (!membership) {
        throw new NotFoundException('El usuario no tiene una membresía activa');
      }

      // Obtener último reconsumo
      const lastReconsumption = await this.reconsumptionRepository.findOne({
        where: { membership: { id: membership.id } },
        order: { periodDate: 'DESC' },
      });

      // Obtener próxima fecha de reconsumo
      const nextReconsumptionDate = new Date(membership.endDate);

      // Verificar si puede hacer reconsumo
      const pendingReconsumption = await this.reconsumptionRepository.findOne({
        where: {
          membership: { id: membership.id },
          status: ReconsumptionStatus.PENDING,
        },
      });

      const today = new Date();

      const canReconsume =
        !pendingReconsumption && today >= nextReconsumptionDate;

      // Formatear respuesta
      return {
        membership: {
          id: membership.id,
          status: membership.status,
          startDate: membership.startDate,
          endDate: membership.endDate,
          autoRenewal: membership.autoRenewal,
          paidAmount: membership.paidAmount,
          plan: {
            id: membership.plan.id,
            name: membership.plan.name,
            price: membership.plan.price,
            binaryPoints: membership.plan.binaryPoints,
            checkAmount: membership.plan.checkAmount,
            commissionPercentage: membership.plan.commissionPercentage,
          },
          nextReconsumptionDate,
        },
        lastReconsumption: lastReconsumption
          ? {
              id: lastReconsumption.id,
              amount: lastReconsumption.amount,
              status: lastReconsumption.status,
              periodDate: lastReconsumption.periodDate,
              createdAt: lastReconsumption.createdAt,
            }
          : null,
        pendingReconsumption: pendingReconsumption
          ? {
              id: pendingReconsumption.id,
              amount: pendingReconsumption.amount,
              status: pendingReconsumption.status,
              periodDate: pendingReconsumption.periodDate,
              createdAt: pendingReconsumption.createdAt,
            }
          : null,
        canReconsume,
      };
    } catch (error) {
      this.logger.error(
        `Error obteniendo detalle de membresía: ${error.message}`,
      );
      throw error;
    }
  }
}
