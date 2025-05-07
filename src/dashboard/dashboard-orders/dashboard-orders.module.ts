import { Module } from '@nestjs/common';
import { DashboardOrdersService } from './dashboard-orders.service';
import { DashboardOrdersController } from './dashboard-orders.controller';
import { OrdersModule } from 'src/orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [DashboardOrdersController],
  providers: [DashboardOrdersService],
})
export class DashboardOrdersModule {}
