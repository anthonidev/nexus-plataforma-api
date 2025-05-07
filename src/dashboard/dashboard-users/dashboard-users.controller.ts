import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardUsersService } from './dashboard-users.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/user/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RangeDatesDto } from 'src/common/dto/range-dates.dto';

@Controller('dashboard-users')
@UseGuards(JwtAuthGuard)
export class DashboardUsersController {
  constructor(private readonly dashboardUsersService: DashboardUsersService) {}

  @Get('all-data')
  @ApiOperation({ summary: 'Obtener datos del dashboard' })
  @ApiResponse({ status: 200, description: 'Datos del dashboard' })
  async getDashboardData(@GetUser() user: User) {
    return this.dashboardUsersService.getDashboardData(user.id);
  }

  @Get('total-users-by-state')
  @ApiOperation({ summary: 'Obtener datos del dashboard' })
  @ApiResponse({ status: 200, description: 'Datos del dashboard' })
  async getTotalUsersByState() {
    return this.dashboardUsersService.getTotalUsersByState();
  }

  @Get('users-created-by-date')
  @ApiOperation({ summary: 'Obtener datos del dashboard' })
  @ApiResponse({ status: 200, description: 'Datos del dashboard' })
  async getUsersCreatedByDate(
    @Query() rangeDatesDto: RangeDatesDto,
  ) {
    return this.dashboardUsersService.getUsersCreatedByDate(rangeDatesDto);
  }

  @Get('total-users-by-range')
  @ApiOperation({ summary: 'Obtener datos del dashboard' })
  @ApiResponse({ status: 200, description: 'Datos del dashboard' })
  async getTotalUsersByRange() {
    return this.dashboardUsersService.getTotalUsersByRange();
  }
}
