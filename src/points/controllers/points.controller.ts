import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import {
  FindPointsTransactionDto,
  FindWeeklyVolumeDto,
} from '../dto/find-weekly-volume.dto';
import { PointsService } from '../services/points.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/paginationDto';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('user-points')
  @ApiOperation({ summary: 'Obtener puntos de usuario en sesión' })
  @ApiResponse({ status: 200, description: 'Puntos de usuario' })
  getUserPoints(@GetUser() user: User) {
    return this.pointsService.getUserPoints(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Obtener transacciones de puntos' })
  @ApiResponse({ status: 200, description: 'Transacciones de puntos' })
  getPointsTransactions(
    @GetUser() user: User,
    @Query() filters: FindPointsTransactionDto,
  ) {
    return this.pointsService.getPointsTransactions(user.id, filters);
  }

  @Get('transaction-details/:id')
  @ApiOperation({ summary: 'Obtener detalles de transacción de puntos' })
  @ApiResponse({ status: 200, description: 'Detalles de transacción de puntos' })
  getPointsTransactionDetails(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.pointsService.getPointsTransactionDetails(
      id,
      paginationDto,
    );
  }

  @Get('weekly-volumes')
  @ApiOperation({ summary: 'Obtener volumenes semanales de puntos' })
  @ApiResponse({ status: 200, description: 'Volumenes semanales de puntos' })
  getWeeklyVolumes(
    @GetUser() user: User,
    @Query() filters: FindWeeklyVolumeDto,
  ) {
    return this.pointsService.getWeeklyVolumes(user.id, filters);
  }

  @Get('weekly-volume-details/:id')
  @ApiOperation({ summary: 'Obtener detalles de volumen semanal de puntos' })
  @ApiResponse({ status: 200, description: 'Detalles de volumen semanal de puntos' })
  getWeeklyVolumeDetails(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.pointsService.getWeeklyVolumeDetails(id, paginationDto);
  }
}
