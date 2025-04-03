import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentConfig } from './entities/payment-config.entity';
import { PaymentImage } from './entities/payment-image.entity';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';
import { FinancePaymentsController } from './controllers/finance-payments.controller';
import { FinancePaymentsService } from './services/finance-payments.service';

@Module({
  controllers: [PaymentsController, FinancePaymentsController],
  providers: [PaymentsService, FinancePaymentsService],
  imports: [TypeOrmModule.forFeature([PaymentConfig, PaymentImage, Payment])],
  exports: [PaymentsService, TypeOrmModule, FinancePaymentsService],
})
export class PaymentsModule {}
