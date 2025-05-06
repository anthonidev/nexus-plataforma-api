import { Controller, Get, Query } from "@nestjs/common";
import { DashboardMembershipsService } from "./dashboard-memberships.service";
import { GetMembershipsByDayDto } from './dto/get-memberships-by-day.dto';

@Controller('dashboard-memberships')
export class DashboardMembershipsController {
  constructor(
    private readonly dashboardMembershipsService: DashboardMembershipsService,
  ) {}

  @Get('memberships-by-day')
  async getMembershipsByDay(
    @Query() getMembershipsByDayDto: GetMembershipsByDayDto,
  ) {
    return this.dashboardMembershipsService.getMembershipsByDay(getMembershipsByDayDto);
  }
}