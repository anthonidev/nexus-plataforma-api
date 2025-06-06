import { Module } from '@nestjs/common';
import { PointsModule } from 'src/points/points.module';
import { RanksModule } from 'src/ranks/ranks.module';
import { UserModule } from 'src/user/user.module';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { DashboardUsersModule } from './dashboard-users/dashboard-users.module';
import { DashboardMembershipsModule } from './dashboard-memberships/dashboard-memberships.module';
import { DashboardPointsModule } from './dashboard-points/dashboard-points.module';
import { DashboardRanksModule } from './dashboard-ranks/dashboard-ranks.module';
import { DashboardPaymentsModule } from './dashboard-payments/dashboard-payments.module';
import { DashboardOrdersModule } from './dashboard-orders/dashboard-orders.module';

@Module({
  controllers: [],
  providers: [],
  imports: [PointsModule, RanksModule, UserModule, MembershipsModule, DashboardUsersModule, DashboardMembershipsModule, DashboardPointsModule, DashboardRanksModule, DashboardPaymentsModule, DashboardOrdersModule],
})
export class DashboardModule {}
