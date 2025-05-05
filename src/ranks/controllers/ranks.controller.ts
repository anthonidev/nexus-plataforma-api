import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { FindMonthlyVolumeRankDto } from '../dto/find-monthly-volume-rank.dto';

import { RanksService } from '../services/ranks.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('ranks')
@UseGuards(JwtAuthGuard)
export class RanksController {
  constructor(private readonly ranksService: RanksService) { }

  @Get()
  @ApiOperation({ summary: 'Obtener rangos de punto del usuario en sesión' })
  @ApiResponse({ status: 200, description: 'Rangos de puntos del usuario en sesión' })
  findAll(@GetUser() user: User) {
    return this.ranksService.findAllRanks(user.id);
  }

  @Get('monthly-volumes')
  @ApiOperation({ summary: 'Obtener volumenes mensuales de rangos de puntos' })
  @ApiResponse({ status: 200, description: 'Volumenes mensuales de rangos de puntos' })
  getMonthlyVolumes(
    @GetUser() user: User,
    @Query() filters: FindMonthlyVolumeRankDto,
  ) {
    return this.ranksService.getMonthlyVolumes(user.id, filters);
  }
}
