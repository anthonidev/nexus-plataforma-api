import { Controller } from '@nestjs/common';
import { DashboardPaymentsService } from './dashboard-payments.service';

@Controller('dashboard-payments')
export class DashboardPaymentsController {
  constructor(private readonly dashboardPaymentsService: DashboardPaymentsService) {}
}
