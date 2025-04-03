import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { FindPaymentsDto } from '../dto/find-payments.dto';
import { FinancePaymentsService } from '../services/finance-payments.service';

@Controller('finance/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FAC', 'ADM', 'SYS')
export class FinancePaymentsController {
  constructor(
    private readonly financePaymentsService: FinancePaymentsService,
  ) {}

  @Get()
  findAll(@Query() filters: FindPaymentsDto) {
    return this.financePaymentsService.findAllPayments(filters);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.financePaymentsService.findOnePayment(id);
  }
}
