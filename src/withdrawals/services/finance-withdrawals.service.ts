import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { Withdrawal } from '../entities/withdrawal.entity';
import { WithdrawalConfig } from '../entities/withdrawal-config.entity';
import { FindWithdrawalsDto } from '../dto/find-withdrawals.dto';
import { formatOneWithdrawalResponse } from '../helpers/format-one-withdrawal-response.helper';

@Injectable()
export class FinanceWithdrawalsService {
  private readonly logger = new Logger(FinanceWithdrawalsService.name);

  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(WithdrawalConfig)
    private readonly withdrawalConfigRepository: Repository<WithdrawalConfig>,
  ) {}

  async findAllWithdrawals(filters: FindWithdrawalsDto) {
    try {
      const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        status,
        order = 'DESC',
        name,
        documentNumber, 
        email,
      } = filters;

      const queryBuilder = this.withdrawalRepository
        .createQueryBuilder('withdrawal')
        .leftJoinAndSelect('withdrawal.reviewedBy', 'reviewer')
        .leftJoinAndSelect('withdrawal.user', 'user')
        .leftJoinAndSelect('user.personalInfo', 'personalInfo');

      if (status) {
        queryBuilder.andWhere('withdrawal.status = :status', { status });
      }

      if (startDate) {
        queryBuilder.andWhere('withdrawal.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });
      }

      if (endDate) {
        // Ajustar la fecha final para incluir todo el día
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);

        queryBuilder.andWhere('withdrawal.createdAt <= :endDate', {
          endDate: endOfDay,
        });
      }

      if (status)
        queryBuilder.andWhere('withdrawal.status = :status', { status });

      if (startDate)
        queryBuilder.andWhere('withdrawal.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        queryBuilder.andWhere('withdrawal.createdAt <= :endDate', {
          endDate: endOfDay,
        });
      }

      if (name)
        queryBuilder.andWhere(
          '(personalInfo.firstName ILIKE :name OR personalInfo.lastName ILIKE :name OR (personalInfo.firstName || \' \' || personalInfo.lastName) ILIKE :name)',
          { name: `%${name}%` },
        );

      if (documentNumber)
        queryBuilder.andWhere('personalInfo.documentNumber ILIKE :documentNumber', { documentNumber: `%${documentNumber}%` });

      if (email)
        queryBuilder.andWhere('user.email ILIKE :email', { email: `%${email}%` });

      queryBuilder
        .orderBy('withdrawal.createdAt', order)
        .skip((page - 1) * limit)
        .take(limit);

      // Seleccionar solo los campos necesarios para el listado
      queryBuilder.select([
        'withdrawal.id',
        'withdrawal.amount',
        'withdrawal.status',
        'withdrawal.createdAt',
        'withdrawal.reviewedAt',
        'withdrawal.bankName',
        'withdrawal.accountNumber',
        'withdrawal.metadata',
        'reviewer.id',
        'reviewer.email',
        'user.id',
        'user.email',
        'personalInfo.firstName',
        'personalInfo.lastName',
        'personalInfo.documentNumber',
      ]);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      // Obtener configuraciones de retiro activas
      const withdrawalConfigs = await this.withdrawalConfigRepository.find({
        where: { isActive: true },
        select: [
          'id',
          'name',
          'code',
          'description',
          'minimumAmount',
          'maximumAmount',
        ],
        order: { name: 'ASC' },
      });

      // Crear una respuesta paginada con metadatos extendidos
      const paginationResponse = PaginationHelper.createPaginatedResponse(
        items,
        totalItems,
        filters,
      );

      return {
        ...paginationResponse,
        meta: {
          ...paginationResponse.meta,
          withdrawalConfigs,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching all withdrawals: ${error.message}`);
      throw error;
    }
  }

  async findOneWithdrawal(id: number): Promise<any> {
    try {
      const paginationDto = { page: 1, limit: 10 };
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id },
        relations: [
          'user',
          'reviewedBy',
          'user.personalInfo',
          'user.contactInfo',
          'user.bankInfo',
          'withdrawalPoints',
          'withdrawalPoints.points',
        ],
      });

      if (!withdrawal) {
        throw new NotFoundException(`Retiro con ID ${id} no encontrado`);
      }

      // Eliminar información sensible
      delete withdrawal.user.password;

      if (withdrawal.reviewedBy) {
        delete withdrawal.reviewedBy.password;
      }

      const formattedWithdrawal = formatOneWithdrawalResponse(withdrawal);
      return {
        ...formattedWithdrawal,
        withdrawalPoints: PaginationHelper.createPaginatedResponse(
          formattedWithdrawal.withdrawalPoints,
          formattedWithdrawal.withdrawalPoints.length,
          paginationDto,
        ),
      };
    } catch (error) {
      this.logger.error(`Error fetching withdrawal ${id}: ${error.message}`);
      throw error;
    }
  }
}
