import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { User } from 'src/user/entities/user.entity';
import {
  ApproveWithdrawalDto,
  RejectWithdrawalDto,
} from '../dto/withdrawal-approval.dto';
import { FinanceWithdrawalApprovalService } from '../services/finance-withdrawal-approval.service';

@Controller('finance/withdrawals/approval')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FAC', 'ADM', 'SYS')
export class FinanceWithdrawalApprovalController {
  constructor(
    private readonly financeWithdrawalApprovalService: FinanceWithdrawalApprovalService,
  ) {}

  @Post(':id/approve')
  approveWithdrawal(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Body() approveWithdrawalDto: ApproveWithdrawalDto,
  ) {
    return this.financeWithdrawalApprovalService.approveWithdrawal(
      id,
      user.id,
      approveWithdrawalDto,
    );
  }

  @Post(':id/reject')
  rejectWithdrawal(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Body() rejectWithdrawalDto: RejectWithdrawalDto,
  ) {
    return this.financeWithdrawalApprovalService.rejectWithdrawal(
      id,
      user.id,
      rejectWithdrawalDto,
    );
  }
}
