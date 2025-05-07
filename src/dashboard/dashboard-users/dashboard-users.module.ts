import { Module } from '@nestjs/common';
import { DashboardUsersService } from './dashboard-users.service';
import { DashboardUsersController } from './dashboard-users.controller';
import { UserModule } from 'src/user/user.module';
import { DashboardMembershipsModule } from '../dashboard-memberships/dashboard-memberships.module';
import { DashboardRanksModule } from '../dashboard-ranks/dashboard-ranks.module';
import { DashboardPointsModule } from '../dashboard-points/dashboard-points.module';

@Module({
  imports: [UserModule, DashboardMembershipsModule, DashboardPointsModule, DashboardRanksModule],
  exports: [DashboardUsersService],
  controllers: [DashboardUsersController],
  providers: [DashboardUsersService],
})
export class DashboardUsersModule {}
