import { Module } from '@nestjs/common';
import { DashboardMembershipsService } from './dashboard-memberships.service';
import { MembershipsModule } from 'src/memberships/memberships.module';

@Module({
  imports: [MembershipsModule],
  exports: [DashboardMembershipsService],
  controllers: [],
  providers: [DashboardMembershipsService],
})
export class DashboardMembershipsModule {}
