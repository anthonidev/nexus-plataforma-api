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

@Controller('finance/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FAC', 'ADM', 'SYS')
export class FinanceWithdrawalsController {
  constructor(
    private readonly financeWithdrawalsService: FinanceWithdrawalsService,
  ) {}

  @Get()
  findAll(@Query() filters: FindWithdrawalsDto) {
    return this.financeWithdrawalsService.findAllWithdrawals(filters);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.financeWithdrawalsService.findOneWithdrawal(id);
  }
}
