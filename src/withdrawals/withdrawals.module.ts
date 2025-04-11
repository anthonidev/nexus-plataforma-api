import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsModule } from 'src/points/points.module';
import { UserModule } from 'src/user/user.module';
import { FinanceWithdrawalApprovalController } from './controller/finance-withdrawal-approval.controller';
import { FinanceWithdrawalsController } from './controller/finance-withdrawals.controller';
import { WithdrawalsController } from './controller/withdrawals.controller';
import { WithdrawalConfig } from './entities/withdrawal-config.entity';
import { Withdrawal } from './entities/withdrawal.entity';
import { FinanceWithdrawalApprovalService } from './services/finance-withdrawal-approval.service';
import { FinanceWithdrawalsService } from './services/finance-withdrawals.service';
import { WithdrawalsService } from './services/withdrawals.service';

@Module({
  controllers: [
    WithdrawalsController,
    FinanceWithdrawalsController,
    FinanceWithdrawalApprovalController,
  ],
  providers: [
    WithdrawalsService,
    FinanceWithdrawalsService,
    FinanceWithdrawalApprovalService,
  ],
  imports: [
    TypeOrmModule.forFeature([WithdrawalConfig, Withdrawal]),
    UserModule,
    PointsModule,
  ],
  exports: [
    WithdrawalsService,
    FinanceWithdrawalsService,
    FinanceWithdrawalApprovalService,
    TypeOrmModule,
  ],
})
export class WithdrawalsModule {}
