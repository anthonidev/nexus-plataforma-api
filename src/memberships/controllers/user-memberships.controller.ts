import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { UserMembershipsService } from '../services/user-memberships.service';
import { CreateMembershipSubscriptionDto } from '../dto/create-membership-subscription.dto';
import { ApproveMembershipSubscriptionDto } from '../dto/approve-membership-subscription.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('user-memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserMembershipsController {
  constructor(
    private readonly userMembershipsService: UserMembershipsService,
  ) {}

  /**
   * Obtiene todas las membresías del usuario autenticado
   */
  @Get()
  getUserMemberships(@GetUser() user) {
    return this.userMembershipsService.getUserMemberships(user.id);
  }

  /**
   * Obtiene el detalle de una membresía específica
   */
  @Get(':id')
  getMembershipDetail(
    @GetUser() user,
    @Param('id', ParseIntPipe) membershipId: number,
  ) {
    return this.userMembershipsService.getMembershipDetail(
      user.id,
      membershipId,
    );
  }

  /**
   * Crea una solicitud de suscripción a un plan
   */
  @Post('subscribe')
  createSubscription(
    @GetUser() user,
    @Body() createDto: CreateMembershipSubscriptionDto,
  ) {
    return this.userMembershipsService.createSubscription(user.id, createDto);
  }

  /**
   * Aprueba o rechaza una solicitud de membresía (solo administradores)
   */
  @Post(':id/approve')
  @Roles('SYS', 'ADM')
  approveSubscription(
    @GetUser() admin,
    @Param('id', ParseIntPipe) membershipId: number,
    @Body() approveDto: ApproveMembershipSubscriptionDto,
  ) {
    return this.userMembershipsService.approveSubscription(
      admin.id,
      membershipId,
      approveDto,
    );
  }
}
