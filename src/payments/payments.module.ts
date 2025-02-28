import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentConfig } from './entities/payment-config.entity';
import { PaymentImage } from './entities/payment-image.entity';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  imports: [TypeOrmModule.forFeature([Payment, PaymentConfig, PaymentImage])],
  exports: [TypeOrmModule],
})
export class PaymentsModule {}
