import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsTransaction } from './entities/points_transactions.entity';
import { UserPoints } from './entities/user_points.entity';
import { WeeklyVolume } from './entities/weekly_volumes.entity';
import { PointsController } from './controllers/points.controller';
import { PointsService } from './services/points.service';
import { UserModule } from 'src/user/user.module';

@Module({
  controllers: [PointsController],
  imports: [
    TypeOrmModule.forFeature([PointsTransaction, UserPoints, WeeklyVolume]),
    UserModule,
  ],
  providers: [PointsService],
  exports: [PointsService, TypeOrmModule],
})
export class PointsModule {}
