import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { FindWithdrawalsDto } from '../dto/find-withdrawals.dto';
import { WithdrawalsService } from '../services/withdrawals.service';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}
  @Post()
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
  getWithdrawalInfo(@GetUser() user: User) {
    return this.withdrawalsService.getWithdrawalInfo(user.id);
  }
}
