import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { PaymentsModule } from 'src/payments/payments.module';
import { Rank } from 'src/ranks/entities/ranks.entity';
import { Role } from 'src/user/entities/roles.entity';
import { View } from 'src/user/entities/view.entity';
import { UserModule } from 'src/user/user.module';
import { WithdrawalsModule } from 'src/withdrawals/withdrawals.module';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { CutsModule } from 'src/cuts/cuts.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([View, Role, MembershipPlan, PaymentConfig, Rank]),
    UserModule,
    MembershipsModule,
    PaymentsModule,
    WithdrawalsModule,
    CutsModule,
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
