import { Module } from '@nestjs/common';
import { DashboardPaymentsService } from './dashboard-payments.service';
import { DashboardPaymentsController } from './dashboard-payments.controller';
import { PaymentsModule } from 'src/payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [DashboardPaymentsController],
  providers: [DashboardPaymentsService],
})
export class DashboardPaymentsModule {}
