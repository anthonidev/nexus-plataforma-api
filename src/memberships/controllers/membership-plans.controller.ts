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

@Controller('membership-plans')
@UseGuards(JwtAuthGuard)
export class MembershipPlansController {
  constructor(
    private readonly membershipPlansService: MembershipPlansService,
  ) {}

  @Get()
  findAll(@Query() filters: FindMembershipPlansDto, @GetUser() user) {
    return this.membershipPlansService.findAll(filters, user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @GetUser() user) {
    return this.membershipPlansService.findOne(id, user.id);
  }
}
