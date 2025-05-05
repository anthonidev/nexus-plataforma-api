import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { MonthlyVolumeStatus } from '../entities/monthly_volume_ranks.entity';
import { ApiProperty } from '@nestjs/swagger';

export class FindMonthlyVolumeRankDto extends PaginationDto {
  @ApiProperty({ example: 'PENDING', type: String, required: false })
  @IsOptional()
  @IsEnum(MonthlyVolumeStatus)
  status?: MonthlyVolumeStatus;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
