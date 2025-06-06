import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { User } from 'src/user/entities/user.entity';
import { FinancePaymentApprovalService } from '../services/finance-paymemts-approval.service';
import { RejectPaymentDto } from '../dto/approval.dto';
import { ApprovePaymentDto } from '../dto/approve-payment.dto';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CompletePaymentDto } from '../dto/complete-payment.dto';

@Controller('finance/payments/approval')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FAC', 'ADM', 'SYS')
export class FinancePaymentApprovalController {
  constructor(
    private readonly financePaymentApprovalService: FinancePaymentApprovalService,
  ) { }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar pago' })
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'Pago aprobado' })
  approvePayment(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Body() approvePaymentDto: ApprovePaymentDto,
  ) {
    return this.financePaymentApprovalService.approvePayment(
      id,
      user.id,
      approvePaymentDto,
    );
  }

  @Put(':id/complete')
  @ApiOperation({ summary: 'Completar pago' })
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'Pago completado' })
  completePayment(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Body() completePaymentDto: CompletePaymentDto,
  ) {
    return this.financePaymentApprovalService.updateDataOrcompletePayment(
      id,
      user.id,
      completePaymentDto,
    );
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Rechazar pago' })
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'Pago rechazado' })
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
