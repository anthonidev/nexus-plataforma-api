import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { DashboardMembershipsService } from "./dashboard-memberships.service";
import { RangeDatesDto } from "src/common/dto/range-dates.dto";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Roles } from "src/auth/decorators/roles.decorator";

@Controller('dashboard-memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardMembershipsController {
  constructor(
    private readonly dashboardMembershipsService: DashboardMembershipsService,
  ) { }

  @Get('memberships-by-day')
  @Roles('ADM', 'FAC')
  async getMembershipsByDay(
    @Query() rangeDatesDto: RangeDatesDto,
  ) {
    return this.dashboardMembershipsService.getMembershipsByDay(rangeDatesDto);
  }

  @Get('total-memberships-by-plan')
  @Roles('ADM', 'FAC')
  async getTotalMembershipsByPlan() {
    return this.dashboardMembershipsService.getTotalMembershipsByPlan();
  }

}