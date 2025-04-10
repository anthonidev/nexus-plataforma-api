import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { MonthlyVolumeStatus } from '../entities/monthly_volume_ranks.entity';

export class FindMonthlyVolumeRankDto extends PaginationDto {
  @IsOptional()
  @IsEnum(MonthlyVolumeStatus)
  status?: MonthlyVolumeStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
