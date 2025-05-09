import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { Repository } from 'typeorm';
import { Order } from '../entities/orders.entity';
import { formatOrderOneResponse } from '../helpers/format-order-one-response.dto';
import { Payment } from 'src/payments/entities/payment.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) { }
  // METHODS FOR ENDPOINTS
  // SYS
  async findAll(
    paginationDto: PaginationDto,
  ) {
    return await this.findAllOrders(paginationDto);
  }

  async findOne(
    id: number,
  ) {
    const order = await this.findOneOrder(id);
    const payment = await this.paymentRepository.findOne({
      where: { relatedEntityId: order.id, relatedEntityType: 'order' },
      select: ['id', 'amount', 'status', 'methodPayment', 'user'],
    });
    return {
      ...formatOrderOneResponse(order),
      payment,
      user: {
        email: order.user.email,
        firstName: order.user.personalInfo?.firstName,
        lastName: order.user.personalInfo?.lastName,
        documentNumber: order.user.personalInfo?.documentNumber,
      }
    };
  }

  // CLIENT
  async findAllWithClients(
    userId: string,
    paginationDto: PaginationDto,
  ) {
    return await this.findAllOrders(paginationDto, userId);
  }

  async findOneWithClients(
    id: number,
    userId: string,
  ) {
    const order = await this.findOneOrder(id, userId);
    return formatOrderOneResponse(order);
  }

  // INTERNAL HELPERS METHODS
  private async findAllOrders(
    paginationDto?: PaginationDto,
    userId?: string,
  ) {
    const { page = 1, limit = 10, order = 'DESC' } = paginationDto;
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.user', 'user')
      .orderBy('order.createdAt', order)
      .skip((page - 1) * limit)
      .take(limit);
    if (userId)
      queryBuilder
        .where('user.id = :userId', { userId });
    if (!userId)
      queryBuilder
        .addSelect(['user.id', 'user.email'])
        .leftJoin('user.personalInfo', 'personalInfo')
        .addSelect(['personalInfo.firstName', 'personalInfo.lastName']);
    const [items, totalItems] = await queryBuilder.getManyAndCount();
    const paginatedResult = PaginationHelper.createPaginatedResponse(
      items,
      totalItems,
      paginationDto,
    );
    return {
      success: true,
      ...paginatedResult,
    };
  }

  private async findOneOrder(
    id: number,
    userId?: string,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'orderDetails', 'orderDetails.product', 'orderDetails.product.images', 'orderHistory', 'user.personalInfo'],
    });

    if (!order) throw new NotFoundException(`Orden con ID ${id} no fue encontrada`);
    if (userId && order.user.id !== userId)
      throw new NotFoundException(`Orden con ID ${id} no pertenece al usuario`);

    return order;
  }
}
