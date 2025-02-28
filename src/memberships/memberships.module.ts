import { Module } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipHistory } from './entities/membership-history.entity';
import { Membership } from './entities/membership.entity';
import { MembershipReconsumption } from './entities/membership-reconsumption.entity';
import { MembershipPlan } from './entities/membership-plan.entity';
import { MembershipUpgrade } from './entities/membership-upgrade.entity';

@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService],
  imports: [
    TypeOrmModule.forFeature([
      MembershipHistory,
      Membership,
      MembershipReconsumption,
      MembershipPlan,
      MembershipUpgrade,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class MembershipsModule {}
