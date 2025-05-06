import { Controller, Get, Query } from '@nestjs/common';
import { DashboardPaymentsService } from './dashboard-payments.service';
import { RangeDatesDto } from 'src/common/dto/range-dates.dto';

@Controller('dashboard-payments')
export class DashboardPaymentsController {
  constructor(private readonly dashboardPaymentsService: DashboardPaymentsService) {}

  @Get('payments-by-concepts')
  getPaymentsByEntityType(
    @Query() rangeDateDto: RangeDatesDto,
  ) {
    return this.dashboardPaymentsService.getPaymentsByEntityType(rangeDateDto);
  }
}
