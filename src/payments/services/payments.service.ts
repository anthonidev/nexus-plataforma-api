import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { Repository } from 'typeorm';
import { FindPaymentsDto } from '../dto/find-payments.dto';
import { PaymentConfig } from '../entities/payment-config.entity';
import { PaymentImage } from '../entities/payment-image.entity';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentImage)
    private readonly paymentImageRepository: Repository<PaymentImage>,
    @InjectRepository(PaymentConfig)
    private readonly paymentConfigRepository: Repository<PaymentConfig>,
  ) { }

  async findAll(filters: FindPaymentsDto, userId: string) {
    try {
      const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        paymentConfigId,
        status,
        order = 'DESC',
      } = filters;

      const queryBuilder = this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.paymentConfig', 'paymentConfig')
        .where('payment.user.id = :userId', { userId });

      if (paymentConfigId) {
        queryBuilder.andWhere('payment.paymentConfig.id = :paymentConfigId', {
          paymentConfigId,
        });
      }

      if (status) {
        queryBuilder.andWhere('payment.status = :status', { status });
      }

      if (startDate) {
        queryBuilder.andWhere('payment.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);

        queryBuilder.andWhere('payment.createdAt <= :endDate', {
          endDate: endOfDay,
        });
      }

      queryBuilder
        .orderBy('payment.createdAt', order)
        .skip((page - 1) * limit)
        .take(limit);

      queryBuilder.select([
        'payment.id',
        'payment.amount',
        'payment.status',
        'payment.createdAt',
        'payment.reviewedAt',
        'payment.relatedEntityType',
        'payment.relatedEntityId',
        'paymentConfig.name',
      ]);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      const paymentConfigs = await this.paymentConfigRepository.find({
        where: { isActive: true },
        select: ['id', 'name'],
        order: { name: 'ASC' },
      });

      const paginationResponse = PaginationHelper.createPaginatedResponse(
        items,
        totalItems,
        filters,
      );

      return {
        ...paginationResponse,
        meta: {
          ...paginationResponse.meta,
          paymentConfigs,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching payments: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: number, userId: string) {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id },
        relations: [
          'user',
          'paymentConfig',
          'reviewedBy',
          'images',
          'user.personalInfo',
          'images.pointsTransaction',
        ],
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          reviewedAt: true,
          isArchived: true,
          methodPayment: true,
          metadata: {
            field1: true,
          },
          rejectionReason: true,
          paymentConfig: {
            name: true,
          },
          user: {
            id: true,
            email: true,
            personalInfo: {
              firstName: true,
              lastName: true,
              documentNumber: true,
            },
          },
          reviewedBy: {
            email: true,
          },
          images: {
            id: true,
            url: true,
            bankName: true,
            amount: true,
            transactionDate: true,
            transactionReference: true,
            pointsTransaction: {
              id: true,
              amount: true,
            }
          },
        },
      });

      if (!payment) {
        throw new NotFoundException(`Pago con ID ${id} no encontrado`);
      }

      if (payment.user.id !== userId) {
        throw new UnauthorizedException('No tienes permiso para ver este pago');
      }

      delete payment.user.password;

      if (payment.reviewedBy) {
        delete payment.reviewedBy.password;
      }

      return payment;
    } catch (error) {
      this.logger.error(`Error fetching payment ${id}: ${error.message}`);
      throw error;
    }
  }
}
