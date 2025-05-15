import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { UserModule } from 'src/user/user.module';
import { RanksController } from './controllers/ranks.controller';
import { MonthlyVolumeRank } from './entities/monthly_volume_ranks.entity';
import { Rank } from './entities/ranks.entity';
import { UserRank } from './entities/user_ranks.entity';
import { RanksService } from './services/ranks.service';

@Module({
  controllers: [RanksController],
  providers: [RanksService],
  imports: [
    TypeOrmModule.forFeature([Rank, UserRank, MonthlyVolumeRank]),
    forwardRef(() => UserModule),
    forwardRef(() => MembershipsModule),
  ],
  exports: [RanksService, TypeOrmModule],
})
export class RanksModule { }
