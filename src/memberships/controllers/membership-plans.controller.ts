import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FindMembershipPlansDto } from '../dto/find-membership-plan.dto';
import { MembershipPlansService } from '../services/membership-plans.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('membership-plans')
@UseGuards(JwtAuthGuard)
export class MembershipPlansController {
  constructor(
    private readonly membershipPlansService: MembershipPlansService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista de planes de membresía' })
  @ApiResponse({ status: 200, description: 'Listado de planes de membresía' })
  findAll(@Query() filters: FindMembershipPlansDto, @GetUser() user) {
    return this.membershipPlansService.findAll(filters, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Plan de membresía del usuario en sesión' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del plan de membresía' })
  @ApiResponse({ status: 200, description: 'Plan de membresía del usuario' })
  findOne(@Param('id', ParseIntPipe) id: number, @GetUser() user) {
    return this.membershipPlansService.findOne(id, user.id);
  }
}
