import { Module } from '@nestjs/common';
import { DashboardMembershipsService } from './dashboard-memberships.service';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { DashboardMembershipsController } from './dashboard-memberships.controller';
import { DashboardPaymentsModule } from '../dashboard-payments/dashboard-payments.module';

@Module({
  imports: [MembershipsModule, DashboardPaymentsModule],
  exports: [DashboardMembershipsService],
  controllers: [DashboardMembershipsController],
  providers: [DashboardMembershipsService],
})
export class DashboardMembershipsModule {}
