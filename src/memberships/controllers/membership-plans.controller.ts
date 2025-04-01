import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/auth/decorators/is-public.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FindMembershipPlansDto } from '../dto/find-membership-plan.dto';
import { MembershipPlansService } from '../services/membership-plans.service';

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

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.membershipPlansService.findOne(id);
  }
}
