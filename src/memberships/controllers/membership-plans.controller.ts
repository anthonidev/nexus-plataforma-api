import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Public } from 'src/auth/decorators/is-public.decorator';
import { MembershipPlansService } from '../services/membership-plans.service';
import { FindMembershipPlansDto } from '../dto/find-membership-plan.dto';

@Controller('membership-plans')
@UseGuards(JwtAuthGuard)
export class MembershipPlansController {
  constructor(
    private readonly membershipPlansService: MembershipPlansService,
  ) {}

  @Public()
  @Get()
  findAll(@Query() filters: FindMembershipPlansDto) {
    return this.membershipPlansService.findAll(filters);
  }
}
