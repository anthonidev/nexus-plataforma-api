import { Module } from '@nestjs/common';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsTransaction } from './entities/points_transactions.entity';
import { RankHistory } from './entities/rank_history.entity';
import { Rank } from './entities/ranks.entity';
import { UserPoints } from './entities/user_points.entity';
import { UserRank } from './entities/user_ranks.entity';
import { WeeklyVolume } from './entities/weekly_volumes.entity';

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
    ]),
  ],
  providers: [PointsService],
  exports: [PointsService, TypeOrmModule],
})
export class PointsModule {}
