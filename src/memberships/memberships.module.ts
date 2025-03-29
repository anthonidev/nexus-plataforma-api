import { Module } from '@nestjs/common';
import { MembershipPlansController } from './controllers/membership-plans.controller';
import { MembershipPlansService } from './services/membership-plans.service';

@Module({
  controllers: [MembershipPlansController],
  providers: [MembershipPlansService],
})
export class MembershipsModule {}
