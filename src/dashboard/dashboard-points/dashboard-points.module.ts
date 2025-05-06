import { Module } from '@nestjs/common';
import { DashboardPointsService } from './dashboard-points.service';
import { PointsModule } from 'src/points/points.module';

@Module({
  imports: [PointsModule],
  exports: [DashboardPointsService],
  controllers: [],
  providers: [DashboardPointsService],
})
export class DashboardPointsModule {}
