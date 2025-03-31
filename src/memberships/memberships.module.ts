import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPlansController } from './controllers/membership-plans.controller';
import { MembershipPlan } from './entities/membership-plan.entity';
import { MembershipReconsumption } from './entities/membership-recosumption.entity';
import { Membership } from './entities/membership.entity';
import { MembershipHistory } from './entities/membership_history.entity';
import { MembershipUpgrade } from './entities/membership_upgrades.entity';
import { MembershipPlansService } from './services/membership-plans.service';

@Module({
  controllers: [MembershipPlansController],
  providers: [MembershipPlansService],
  imports: [
    TypeOrmModule.forFeature([
      MembershipPlan,
      MembershipHistory,
      MembershipUpgrade,
      MembershipReconsumption,
      Membership,
    ]),
  ],
  exports: [MembershipPlansService, TypeOrmModule],
})
export class MembershipsModule {}
