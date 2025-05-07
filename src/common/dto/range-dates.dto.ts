import { IsOptional, IsString } from "class-validator";

export class RangeDatesDto {
  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}