import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawalsController } from './controller/withdrawals.controller';
import { WithdrawalConfig } from './entities/withdrawal-config.entity';
import { Withdrawal } from './entities/withdrawal.entity';
import { WithdrawalsService } from './services/withdrawals.service';
import { UserModule } from 'src/user/user.module';
import { PointsModule } from 'src/points/points.module';

@Module({
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  imports: [
    TypeOrmModule.forFeature([WithdrawalConfig, Withdrawal]),
    UserModule,
    PointsModule,
  ],
  exports: [WithdrawalsService, TypeOrmModule],
})
export class WithdrawalsModule {}
