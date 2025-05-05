import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { User } from 'src/user/entities/user.entity';
import { MembershipService } from '../services/membership.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('user-memberships')
@UseGuards(JwtAuthGuard)
export class MembershipHistoryController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('history')
  @ApiOperation({ summary: 'Historial de membresía del usuario en sesión' })
  @ApiResponse({status: 200, description: 'Historial de membresía'})
  getMembershipHistory(
    @GetUser() user: User,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.membershipService.getMembershipHistory(user.id, paginationDto);
  }

  @Get('reconsumptions')
  @ApiOperation({ summary: 'Reconsumiciones de membresía del usuario en sesión' })
  @ApiResponse({status: 200, description: 'Reconsumiciones de membresía'})
  getReconsumptions(
    @GetUser() user: User,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.membershipService.getReconsumptions(user.id, paginationDto);
  }

  @Get('membership-detail')
  @ApiOperation({ summary: 'Detalle de membresía del usuario en sesión' })
  @ApiResponse({status: 200, description: 'Detalle de membresía'})
  getMembershipDetail(@GetUser() user: User) {
    return this.membershipService.getMembershipDetail(user.id);
  }
}
