import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPlansController } from './controllers/membership-plans.controller';
import { MembershipPlan } from './entities/membership-plan.entity';
import { MembershipReconsumption } from './entities/membership-recosumption.entity';
import { Membership } from './entities/membership.entity';
import { MembershipHistory } from './entities/membership_history.entity';
import { MembershipUpgrade } from './entities/membership_upgrades.entity';
import { MembershipPlansService } from './services/membership-plans.service';
import { UserMembershipsService } from './services/user-memberships.service';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { PaymentImage } from 'src/payments/entities/payment-image.entity';
import { User } from 'src/user/entities/user.entity';
import { UserMembershipsController } from './controllers/user-memberships.controller';

@Module({
  controllers: [MembershipPlansController, UserMembershipsController],
  providers: [MembershipPlansService, UserMembershipsService],
  imports: [
    TypeOrmModule.forFeature([
      MembershipPlan,
      MembershipHistory,
      MembershipUpgrade,
      MembershipReconsumption,
      Membership,
      PaymentConfig,
      Payment,
      PaymentImage,
      User,
    ]),
  ],
  exports: [MembershipPlansService, UserMembershipsService, TypeOrmModule],
})
export class MembershipsModule {}
