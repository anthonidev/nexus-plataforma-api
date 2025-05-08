import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderCreationController } from './controllers/order-creation.controller';
import { OrdersController } from './controllers/orders.controller';
import { OrdersDetails } from './entities/orders-details.entity';
import { OrderHistory } from './entities/orders-history.entity';
import { Order } from './entities/orders.entity';
import { OrderCreationService } from './services/order-creation.service';
import { OrdersService } from './services/orders.service';
import { PaymentsModule } from 'src/payments/payments.module';
import { EcommerceModule } from 'src/ecommerce/ecommerce.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { UserModule } from 'src/user/user.module';
import { PointsModule } from 'src/points/points.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrdersDetails,
      OrderHistory,
    ]),

    forwardRef(() => PaymentsModule),
    EcommerceModule,
    CloudinaryModule,
    UserModule,
    PointsModule,
  ],
  controllers: [OrdersController, OrderCreationController],
  providers: [OrdersService, OrderCreationService],
  exports: [
    TypeOrmModule,
    OrdersService,
    OrderCreationService,

  ]


})
export class OrdersModule { }
