import { forwardRef, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from 'src/user/user.module';
import { PointsController } from './controllers/points.controller';
import { PointsTransactionPayment } from './entities/points-transactions-payments.entity';
import { PointsTransaction } from './entities/points_transactions.entity';
import { UserPoints } from './entities/user_points.entity';
import { WeeklyVolumesHistory } from './entities/weekly-volumes-history.entity';
import { WeeklyVolume } from './entities/weekly_volumes.entity';
import { PointsGateway } from './points.gateway';
import { PointsEventsService } from './services/points-events.service';
import { PointsService } from './services/points.service';
import { UserPointsController } from './controllers/user-points.controller';
import { UserPointsService } from './services/user-points.service';

@Module({
  controllers: [PointsController, UserPointsController],
  imports: [
    TypeOrmModule.forFeature([PointsTransaction, UserPoints, WeeklyVolume, WeeklyVolumesHistory, PointsTransactionPayment]),
    EventEmitterModule.forRoot(),
    forwardRef(() => UserModule),
  ],
  providers: [PointsService, PointsGateway, PointsEventsService, UserPointsService],
  exports: [PointsService, PointsEventsService, TypeOrmModule],
})
export class PointsModule { }