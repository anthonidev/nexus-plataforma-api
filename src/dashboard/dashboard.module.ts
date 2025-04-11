import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PointsModule } from 'src/points/points.module';
import { RanksModule } from 'src/ranks/ranks.module';
import { UserModule } from 'src/user/user.module';
import { MembershipsModule } from 'src/memberships/memberships.module';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  imports: [PointsModule, RanksModule, UserModule, MembershipsModule],
})
export class DashboardModule {}
