import { Module } from '@nestjs/common';
import { DashboardMembershipsService } from './dashboard-memberships.service';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { DashboardMembershipsController } from './dashboard-memberships.controller';

@Module({
  imports: [MembershipsModule],
  exports: [DashboardMembershipsService],
  controllers: [DashboardMembershipsController],
  providers: [DashboardMembershipsService],
})
export class DashboardMembershipsModule {}
