import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsTransaction } from './entities/points_transactions.entity';
import { RankHistory } from './entities/rank_history.entity';
import { Rank } from './entities/ranks.entity';
import { UserPoints } from './entities/user_points.entity';
import { UserRank } from './entities/user_ranks.entity';
import { WeeklyVolume } from './entities/weekly_volumes.entity';
import { PointsController } from './controllers/points.controller';
import { PointsService } from './services/points.service';
import { UserModule } from 'src/user/user.module';
import { MonthlyVolumeRank } from './entities/monthly_volume_ranks.entity';

@Module({
  controllers: [PointsController],
  imports: [
    TypeOrmModule.forFeature([
      PointsTransaction,
      RankHistory,
      Rank,
      UserPoints,
      UserRank,
      WeeklyVolume,
      MonthlyVolumeRank,
    ]),
    UserModule,
  ],
  providers: [PointsService],
  exports: [PointsService, TypeOrmModule],
})
export class PointsModule {}
