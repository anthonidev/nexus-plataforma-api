import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RangeDatesDto } from 'src/common/dto/range-dates.dto';
import { getFinalDayMonth } from 'src/common/helpers/get-final-day-month.helper';
import { getInitialMonth } from 'src/common/helpers/get-initial-month.helper';
import { Order } from 'src/orders/entities/orders.entity';
import { OrderAction } from 'src/orders/enums/orders-action.enum';
import { Repository } from 'typeorm';

@Injectable()
export class DashboardOrdersService {
  private readonly logger = new Logger(DashboardOrdersService.name);
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}
  // REPORTE DE ORDENES POR DIA
  async getUsersCreatedByDate(
    rangeDatesDto: RangeDatesDto,
  ) {
    try {
      const {
        startDate = getInitialMonth(),
        endDate = getFinalDayMonth(),
      } = rangeDatesDto;

      const result = await this.ordersRepository
        .createQueryBuilder('o')
        .innerJoin('o.orderHistory', 'oh')
        .select("TO_CHAR(oh.createdAt, 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(oh.id)', 'cantidad')
        .where('oh.createdAt >= :startDate', { startDate })
        .andWhere('oh.createdAt <= :endDate', { endDate })
        .andWhere('oh.action = :action', { action: OrderAction.APPROVED })
        .groupBy('date')
        .orderBy('date', 'ASC')
        .getRawMany();

      return result.map(item => ({
        date: item.date,
        cantidad: parseInt(item.cantidad, 10),
      }));
    } catch (error) {
      this.logger.error(`Error obteniendo usuarios creados por fecha: ${error.message}`, error.stack);
      throw error;
    }
  }
}
