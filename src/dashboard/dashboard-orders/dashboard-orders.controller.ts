import { Controller, Get, Query } from '@nestjs/common';
import { DashboardOrdersService } from './dashboard-orders.service';
import { RangeDatesDto } from 'src/common/dto/range-dates.dto';

@Controller('dashboard-orders')
export class DashboardOrdersController {
  constructor(private readonly dashboardOrdersService: DashboardOrdersService) {}

  @Get('orders-by-day')
  async getOrdersByDay(
    @Query() rangeDatesDto: RangeDatesDto,
  ) {
    return this.dashboardOrdersService.getUsersCreatedByDate(rangeDatesDto);
  }
}
