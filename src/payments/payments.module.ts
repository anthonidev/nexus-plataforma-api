import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentConfig } from './entities/payment-config.entity';
import { PaymentImage } from './entities/payment-image.entity';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  imports: [TypeOrmModule.forFeature([PaymentConfig, PaymentImage, Payment])],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
