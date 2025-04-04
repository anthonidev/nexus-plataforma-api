import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { PointsService } from '../services/points.service';
import {
  FindPointsTransactionDto,
  FindWeeklyVolumeDto,
} from '../dto/find-weekly-volume.dto';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('user-points')
  getUserPoints(@GetUser() user: User) {
    return this.pointsService.getUserPoints(user.id);
  }

  @Get('transactions')
  getPointsTransactions(
    @GetUser() user: User,
    @Query() filters: FindPointsTransactionDto,
  ) {
    return this.pointsService.getPointsTransactions(user.id, filters);
  }

  @Get('weekly-volumes')
  getWeeklyVolumes(
    @GetUser() user: User,
    @Query() filters: FindWeeklyVolumeDto,
  ) {
    return this.pointsService.getWeeklyVolumes(user.id, filters);
  }
}
