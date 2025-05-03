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
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('finance/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FAC', 'ADM', 'SYS')
export class FinancePaymentsController {
  constructor(
    private readonly financePaymentsService: FinancePaymentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Obtener pagos' })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Listado de pagos' })
  findAll(@Query() filters: FindPaymentsDto) {
    return this.financePaymentsService.findAllPayments(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener pago' })
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'Pago solicitado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.financePaymentsService.findOnePayment(id);
  }
}
