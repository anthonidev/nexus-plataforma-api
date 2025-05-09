import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardPaymentsService } from './dashboard-payments.service';
import { RangeDatesDto } from 'src/common/dto/range-dates.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('dashboard-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardPaymentsController {
  constructor(private readonly dashboardPaymentsService: DashboardPaymentsService) { }

  @Get('payments-by-concepts')
  @Roles('ADM', 'FAC')
  getPaymentsByEntityType(
    @Query() rangeDateDto: RangeDatesDto,
  ) {
    return this.dashboardPaymentsService.getPaymentsByEntityType(rangeDateDto);
  }
}
