import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { OrdersModule } from 'src/orders/orders.module';
import { PointsModule } from 'src/points/points.module';
import { RanksModule } from 'src/ranks/ranks.module';
import { UserModule } from 'src/user/user.module';
import { FinancePaymentApprovalController } from './controllers/finance-paymemts-approval.controller';
import { FinancePaymentsController } from './controllers/finance-payments.controller';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentConfig } from './entities/payment-config.entity';
import { PaymentImage } from './entities/payment-image.entity';
import { Payment } from './entities/payment.entity';
import { DirectBonusService } from './services/direct-bonus.service';
import { FinancePaymentApprovalService } from './services/finance-paymemts-approval.service';
import { FinancePaymentsService } from './services/finance-payments.service';
import { MembershipPaymentService } from './services/membership-payment.service';
import { OrderPaymentService } from './services/order-payment.service';
import { PaymentsService } from './services/payments.service';
import { PlanUpgradeService } from './services/plan-upgrade.service';
import { ReconsumptionService } from './services/reconsumption.service';
import { TreeVolumeService } from './services/tree-volumen.service';

@Module({
  controllers: [
    PaymentsController,
    FinancePaymentsController,
    FinancePaymentApprovalController,
  ],
  providers: [
    PaymentsService,
    FinancePaymentsService,
    DirectBonusService,
    TreeVolumeService,
    MembershipPaymentService,
    PlanUpgradeService,
    ReconsumptionService,
    FinancePaymentApprovalService,
    OrderPaymentService
  ],
  imports: [
    TypeOrmModule.forFeature([PaymentConfig, PaymentImage, Payment]),
    UserModule,
    MembershipsModule,
    PointsModule,
    RanksModule,
    NotificationsModule,
    forwardRef(() => OrdersModule),

  ],
  exports: [
    PaymentsService,
    TypeOrmModule,
    FinancePaymentsService,
    FinancePaymentApprovalService,
  ],
})
export class PaymentsModule { }