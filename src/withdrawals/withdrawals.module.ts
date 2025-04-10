import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawalConfig } from './entities/withdrawal-config.entity';
import { Withdrawal } from './entities/withdrawal.entity';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  imports: [TypeOrmModule.forFeature([WithdrawalConfig, Withdrawal])],
  exports: [WithdrawalsService, TypeOrmModule],
})
export class WithdrawalsModule {}
