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
import { FindWithdrawalsDto } from '../dto/find-withdrawals.dto';
import { FinanceWithdrawalsService } from '../services/finance-withdrawals.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('finance/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FAC', 'ADM', 'SYS')
export class FinanceWithdrawalsController {
  constructor(
    private readonly financeWithdrawalsService: FinanceWithdrawalsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Obtener retiros' })
  @ApiResponse({ status: 200, description: 'Listado de retiros' })
  findAll(@Query() filters: FindWithdrawalsDto) {
    return this.financeWithdrawalsService.findAllWithdrawals(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un retiro' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del retiro' })
  @ApiResponse({ status: 200, description: 'Retiro obtenido' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.financeWithdrawalsService.findOneWithdrawal(id);
  }
}
