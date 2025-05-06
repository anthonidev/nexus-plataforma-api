import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardUsersService } from './dashboard-users.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/user/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

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
}
