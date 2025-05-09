import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { Repository } from 'typeorm';
import { FindPaymentsDto } from '../dto/find-payments.dto';
import { PaymentConfig } from '../entities/payment-config.entity';
import { PaymentImage } from '../entities/payment-image.entity';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class FinancePaymentsService {
  private readonly logger = new Logger(FinancePaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentImage)
    private readonly paymentImageRepository: Repository<PaymentImage>,
    @InjectRepository(PaymentConfig)
    private readonly paymentConfigRepository: Repository<PaymentConfig>,
  ) { }

  async findAllPayments(filters: FindPaymentsDto) {
    try {
      const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        paymentConfigId,
        status,
        order = 'DESC',
        search,
      } = filters;

      const queryBuilder = this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.paymentConfig', 'paymentConfig')
        .leftJoinAndSelect('payment.reviewedBy', 'reviewer')
        .leftJoinAndSelect('payment.user', 'user')
        .leftJoinAndSelect('user.personalInfo', 'personalInfo')
        .leftJoinAndSelect('user.contactInfo', 'contactInfo');

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
      if (search) {
        queryBuilder.andWhere(
          '(personalInfo.firstName LIKE :search OR personalInfo.lastName LIKE :search OR user.email LIKE :search OR personalInfo.documentNumber LIKE :search)',
          { search: `%${search}%` },
        );
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
        'paymentConfig.name',
        'reviewer.id',
        'reviewer.email',
        'user.id',
        'user.photo',
        'user.email',
        'personalInfo.firstName',
        'personalInfo.lastName',
        'personalInfo.documentNumber',
        'contactInfo.phone',
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
      this.logger.error(`Error fetching all payments: ${error.message}`);
      throw error;
    }
  }

  async findOnePayment(id: number): Promise<Payment> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id },
        relations: [
          'user',
          'paymentConfig',
          'reviewedBy',
          'images',
          'user.personalInfo',
          'user.contactInfo',
          'images.pointsTransaction',
        ],
        select: {
          id: true,
          user: {
            email: true,
            personalInfo: {
              firstName: true,
              lastName: true,
              documentNumber: true,
            },
            contactInfo: {
              phone: true,
            },
          },
          paymentConfig: {
            name: true,
          },
          amount: true,
          status: true,

          codeOperation: true,
          banckName: true,
          dateOperation: true,
          numberTicket: true,
          methodPayment: true,

          rejectionReason: true,
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
            },
          },

          createdAt: true,
          updatedAt: true,
          reviewedBy: {
            email: true,
          },

          reviewedAt: true,
          isArchived: true,

          metadata: {
            field1: true,
          },
        },
      });

      if (!payment) {
        throw new NotFoundException(`Pago con ID ${id} no encontrado`);
      }

      return payment;
    } catch (error) {
      this.logger.error(`Error fetching payment ${id}: ${error.message}`);
      throw error;
    }
  }
}
