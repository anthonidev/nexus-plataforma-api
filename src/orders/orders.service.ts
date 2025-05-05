import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/orders.entity';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { formatOrderOneResponse } from './helpers/format-order-one-response.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}
  // METHODS FOR ENDPOINTS
  // FAC - SYS

  // CLIENT
  async findAllWithClients(
    userId: string,
    paginationDto: PaginationDto,
  ) {
    return await this.findAllOrders(userId, paginationDto);
  }

  async findOneWithClients(
    id: string,
    userId: string,
  ) {
    const order = await this.findOneOrder(id, userId);
    return formatOrderOneResponse(order);
  }

  // INTERNAL HELPERS METHODS
  private async findAllOrders(
    userId?: string,
    paginationDto?: PaginationDto,
  ) {
    const { page = 1, limit = 10, order = 'DESC' } = paginationDto;
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.user', 'user')
      .orderBy('order.createdAt', order)
      .skip((page - 1) * limit)
      .take(limit);
    if (userId)
      queryBuilder.where('user.id = :userId', { userId });
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
    id: string,
    userId?: string,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'orderDetails', 'orderDetails.product', 'orderDetails.product.images', 'orderHistory'],
    });

    if (!order) throw new NotFoundException(`Orden con ID ${id} no fue encontrada`);
    if (userId && order.user.id !== userId)
      throw new NotFoundException(`Orden con ID ${id} no pertenece al usuario`);

    return order;
  }
}
