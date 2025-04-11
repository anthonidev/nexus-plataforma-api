import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { FindWithdrawalsDto } from '../dto/find-withdrawals.dto';
import { WithdrawalsService } from '../services/withdrawals.service';

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

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
