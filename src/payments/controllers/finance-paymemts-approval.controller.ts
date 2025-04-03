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
import { FinancePaymentApprovalService } from '../services/finance-paymemts-approval.service';
import { RejectPaymentDto } from '../dto/approval.dto';

@Controller('finance/payments/approval')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FAC', 'ADM', 'SYS')
export class FinancePaymentApprovalController {
  constructor(
    private readonly financePaymentApprovalService: FinancePaymentApprovalService,
  ) {}

  @Post(':id/approve')
  approvePayment(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    return this.financePaymentApprovalService.approvePayment(id, user.id);
  }

  @Post(':id/reject')
  rejectPayment(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Body() rejectPaymentDto: RejectPaymentDto,
  ) {
    return this.financePaymentApprovalService.rejectPayment(
      id,
      user.id,
      rejectPaymentDto,
    );
  }
}
