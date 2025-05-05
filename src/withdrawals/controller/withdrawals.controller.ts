import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { FindWithdrawalsDto } from '../dto/find-withdrawals.dto';
import { WithdrawalsService } from '../services/withdrawals.service';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}
  @Post()
  @ApiOperation({ summary: 'Crear retiro' })
  @ApiResponse({ status: 200, description: 'Retiro creado' })
  createWithdrawal(
    @GetUser() user: User,
    @Body() createWithdrawalDto: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.createWithdrawal(
      user.id,
      createWithdrawalDto,
    );
  }
  @Get()
  @ApiOperation({ summary: 'Obtener retiros de un usuario' })
  @ApiResponse({ status: 200, description: 'Listado de retiros' })
  findUserWithdrawals(
    @GetUser() user: User,
    @Query() findWithdrawalsDto: FindWithdrawalsDto,
  ) {
    return this.withdrawalsService.findUserWithdrawals(
      user.id,
      findWithdrawalsDto,
    );
  }

  @Get('info')
  @ApiOperation({ summary: 'Obtener información de retiros del usuario en sesión' })
  @ApiResponse({ status: 200, description: 'Información de retiros del usuario' })
  getWithdrawalInfo(@GetUser() user: User) {
    return this.withdrawalsService.getWithdrawalInfo(user.id);
  }
}
