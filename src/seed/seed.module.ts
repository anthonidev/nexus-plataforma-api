import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { View } from 'src/user/entities/view.entity';
import { Role } from 'src/user/entities/roles.entity';
import { UserModule } from 'src/user/user.module';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { Rank } from 'src/points/entities/ranks.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([View, Role, MembershipPlan, PaymentConfig, Rank]),
    UserModule,
    MembershipsModule,
    PaymentsModule,
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
