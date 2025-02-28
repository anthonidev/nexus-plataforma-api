import { Module } from '@nestjs/common';
import { BinaryService } from './binary.service';
import { BinaryController } from './binary.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyVolume } from './entities/weekly-volume.entity';
import { PointsTransaction } from './entities/points-transaction.entity';
import { UserPoints } from './entities/user-points.entity';

@Module({
  controllers: [BinaryController],
  providers: [BinaryService],
  imports: [
    TypeOrmModule.forFeature([WeeklyVolume, PointsTransaction, UserPoints]),
  ],
  exports: [TypeOrmModule],
})
export class BinaryModule {}
