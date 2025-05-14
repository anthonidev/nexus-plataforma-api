import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { UserPointsService } from "../services/user-points.service";
import { GetUserPointsDto } from "../dto/get-user-points.dto";
import { FindPointsTransactionDto } from "../dto/find-weekly-volume.dto";
import { PaginationDto } from "src/common/dto/paginationDto";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Roles } from "src/auth/decorators/roles.decorator";

@Controller('user-points')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserPointsController {
  constructor(private readonly userPointsService: UserPointsService) {}

  @Get('list')
  @Roles('FAC')
  getUserPoints(
    @Query() getUsetPointsDto: GetUserPointsDto,
  ) {
    return this.userPointsService.getUserPoints(getUsetPointsDto);
  }

  @Get('transactions/:id')
  @Roles('FAC')
  getUserPointsTransactions(
    @Param('id') id: string,
    @Query() filters: FindPointsTransactionDto,
  ) {
    return this.userPointsService.getUserPointsTransactions(
      id,
      filters,
    );
  }

  @Get('transactions/:id/payments/:userId')
  @Roles('FAC')
  getUserPointsTransactionPayments(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId') userId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.userPointsService.getUserPointsTransactionPayments(
      id,
      userId,
      paginationDto,
    );
  }
}