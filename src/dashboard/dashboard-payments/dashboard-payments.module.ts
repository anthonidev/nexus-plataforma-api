import { Module } from '@nestjs/common';
import { DashboardPaymentsService } from './dashboard-payments.service';
import { DashboardPaymentsController } from './dashboard-payments.controller';
import { PaymentsModule } from 'src/payments/payments.module';
import { MembershipsModule } from 'src/memberships/memberships.module';

@Module({
  imports: [PaymentsModule, MembershipsModule],
  exports: [DashboardPaymentsService],
  controllers: [DashboardPaymentsController],
  providers: [DashboardPaymentsService],
})
export class DashboardPaymentsModule {}
