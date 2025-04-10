import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rank } from './entities/ranks.entity';
import { UserRank } from './entities/user_ranks.entity';
import { MonthlyVolumeRank } from './entities/monthly_volume_ranks.entity';
import { UserModule } from 'src/user/user.module';
import { RanksController } from './controllers/ranks.controller';
import { RanksService } from './services/ranks.service';

@Module({
  controllers: [RanksController],
  providers: [RanksService],
  imports: [
    TypeOrmModule.forFeature([Rank, UserRank, MonthlyVolumeRank]),
    UserModule,
  ],
  exports: [RanksService, TypeOrmModule],
})
export class RanksModule {}
