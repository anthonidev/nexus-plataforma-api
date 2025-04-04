import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancePaymentApprovalController } from './controllers/finance-paymemts-approval.controller';
import { FinancePaymentsController } from './controllers/finance-payments.controller';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentConfig } from './entities/payment-config.entity';
import { PaymentImage } from './entities/payment-image.entity';
import { Payment } from './entities/payment.entity';
import { FinancePaymentApprovalService } from './services/finance-paymemts-approval.service';
import { FinancePaymentsService } from './services/finance-payments.service';
import { PaymentsService } from './services/payments.service';
import { UserModule } from 'src/user/user.module';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { PointsModule } from 'src/points/points.module';

@Module({
  controllers: [
    PaymentsController,
    FinancePaymentsController,
    FinancePaymentApprovalController,
  ],
  providers: [
    PaymentsService,
    FinancePaymentsService,
    FinancePaymentApprovalService,
  ],
  imports: [
    TypeOrmModule.forFeature([PaymentConfig, PaymentImage, Payment]),
    UserModule,
    MembershipsModule,
    PointsModule,
  ],
  exports: [
    PaymentsService,
    TypeOrmModule,
    FinancePaymentsService,
    FinancePaymentApprovalService,
  ],
})
export class PaymentsModule {}
