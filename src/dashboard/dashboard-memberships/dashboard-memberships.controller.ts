import { Controller, Get, Query } from "@nestjs/common";
import { DashboardMembershipsService } from "./dashboard-memberships.service";
import { RangeDatesDto } from "src/common/dto/range-dates.dto";
@Controller('dashboard-memberships')
export class DashboardMembershipsController {
  constructor(
    private readonly dashboardMembershipsService: DashboardMembershipsService,
  ) {}

  @Get('memberships-by-day')
  async getMembershipsByDay(
    @Query() rangeDatesDto: RangeDatesDto,
  ) {
    return this.dashboardMembershipsService.getMembershipsByDay(rangeDatesDto);
  }
}