import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { FindMonthlyVolumeRankDto } from '../dto/find-monthly-volume-rank.dto';

import { RanksService } from '../services/ranks.service';

@Controller('ranks')
@UseGuards(JwtAuthGuard)
export class RanksController {
  constructor(private readonly ranksService: RanksService) { }

  @Get()
  findAll(@GetUser() user: User) {
    return this.ranksService.findAllRanks(user.id);
  }

  @Get('monthly-volumes')
  getMonthlyVolumes(
    @GetUser() user: User,
    @Query() filters: FindMonthlyVolumeRankDto,
  ) {
    return this.ranksService.getMonthlyVolumes(user.id, filters);
  }
}
