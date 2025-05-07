import { Module } from '@nestjs/common';
import { DashboardRanksService } from './dashboard-ranks.service';
import { RanksModule } from 'src/ranks/ranks.module';

@Module({
  imports: [RanksModule],
  exports: [DashboardRanksService],
  controllers: [],
  providers: [DashboardRanksService],
})
export class DashboardRanksModule {}
