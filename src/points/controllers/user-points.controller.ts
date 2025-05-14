import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { UserPointsService } from "../services/user-points.service";
import { GetUserPointsDto } from "../dto/get-user-points.dto";
import { FindPointsTransactionDto } from "../dto/find-weekly-volume.dto";
import { PaginationDto } from "src/common/dto/paginationDto";

@Controller('user-points')
export class UserPointsController {
  constructor(private readonly userPointsService: UserPointsService) {}
  @Get('list')
  getUserPoints(
    @Query() getUsetPointsDto: GetUserPointsDto,
  ) {
    return this.userPointsService.getUserPoints(getUsetPointsDto);
  }

  @Get('transactions/:id')
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