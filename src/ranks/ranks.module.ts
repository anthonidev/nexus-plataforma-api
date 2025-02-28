import { Module } from '@nestjs/common';
import { RanksService } from './ranks.service';
import { RanksController } from './ranks.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RankHistory } from './entities/rank-history.entity';
import { UserRank } from './entities/user-rank.entity';
import { Rank } from './entities/rank.entity';

@Module({
  controllers: [RanksController],
  providers: [RanksService],
  imports: [TypeOrmModule.forFeature([RankHistory, Rank, UserRank])],
  exports: [TypeOrmModule],
})
export class RanksModule {}
