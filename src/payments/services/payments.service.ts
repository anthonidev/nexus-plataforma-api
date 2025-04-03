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
  ) {}

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
        .leftJoinAndSelect('payment.reviewedBy', 'reviewer')
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
        // Ajustar la fecha final para incluir todo el día
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

      // Seleccionar solo los campos necesarios para el listado
      queryBuilder.select([
        'payment.id',
        'payment.amount',
        'payment.status',
        'payment.createdAt',
        'payment.reviewedAt',
        'payment.relatedEntityType',
        'payment.relatedEntityId',
        'paymentConfig.id',
        'paymentConfig.name',
        'paymentConfig.code',
        'reviewer.id',
        'reviewer.email',
      ]);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      // Obtener todos los PaymentConfigs activos
      const paymentConfigs = await this.paymentConfigRepository.find({
        where: { isActive: true },
        select: ['id', 'name', 'code', 'description'],
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
        relations: ['user', 'paymentConfig', 'reviewedBy', 'images'],
      });

      if (!payment) {
        throw new NotFoundException(`Pago con ID ${id} no encontrado`);
      }

      // Verificar que el pago pertenezca al usuario actual
      if (payment.user.id !== userId) {
        throw new UnauthorizedException('No tienes permiso para ver este pago');
      }

      // Eliminar información sensible
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
