import { IsOptional, IsString } from "class-validator";

export class GetMembershipsByDayDto {
  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}