import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { DashboardService } from './dashboard.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener datos del dashboard' })
  @ApiResponse({ status: 200, description: 'Datos del dashboard' })
  async getDashboardData(@GetUser() user: User) {
    return this.dashboardService.getDashboardData(user.id);
  }
}
