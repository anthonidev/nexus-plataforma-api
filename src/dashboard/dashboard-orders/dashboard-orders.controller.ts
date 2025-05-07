import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardOrdersService } from './dashboard-orders.service';
import { RangeDatesDto } from 'src/common/dto/range-dates.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('dashboard-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardOrdersController {
  constructor(private readonly dashboardOrdersService: DashboardOrdersService) {}

  @Get('orders-by-day')
  @Roles('ADM')
  async getOrdersByDay(
    @Query() rangeDatesDto: RangeDatesDto,
  ) {
    return this.dashboardOrdersService.getUsersCreatedByDate(rangeDatesDto);
  }
}
