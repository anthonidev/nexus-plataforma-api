import { Controller, Get, Query } from "@nestjs/common";
import { UserPointsService } from "../services/user-points.service";
import { PaginationDto } from "src/common/dto/paginationDto";
import { GetUserPointsDto } from "../dto/get-user-points.dto";

@Controller('user-points')
export class UserPointsController {
  constructor(private readonly userPointsService: UserPointsService) {}
  @Get()
  getUserPoints(
    @Query() getUsetPointsDto: GetUserPointsDto,
  ) {
    return this.userPointsService.getUserPoints(getUsetPointsDto);
  }
}