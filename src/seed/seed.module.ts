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
import { CutsModule } from 'src/cuts/cuts.module';
import { SeedController } from './controllers/seed.controller';
import { SeedService } from './services/seed.service';
import { GlobalAccountsController } from './controllers/global-accounts.controller';
import { GlobalAccountsSeedService } from './services/global-accounts-seed.service';
import { EcommerceModule } from 'src/ecommerce/ecommerce.module';
import { ProductCategory } from 'src/ecommerce/entities/product-category.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([View, Role, MembershipPlan, PaymentConfig, Rank, ProductCategory]),
    UserModule,
    MembershipsModule,
    PaymentsModule,
    WithdrawalsModule,
    CutsModule,
    EcommerceModule,
  ],
  controllers: [SeedController, GlobalAccountsController],
  providers: [SeedService, GlobalAccountsSeedService],
})
export class SeedModule { }
