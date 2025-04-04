import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/paginationDto';
import {
  PointTransactionStatus,
  PointTransactionType,
} from '../entities/points_transactions.entity';
import { VolumeProcessingStatus } from '../entities/weekly_volumes.entity';

export class FindPointsTransactionDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PointTransactionType)
  type?: PointTransactionType;

  @IsOptional()
  @IsEnum(PointTransactionStatus)
  status?: PointTransactionStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class FindWeeklyVolumeDto extends PaginationDto {
  @IsOptional()
  @IsEnum(VolumeProcessingStatus)
  status?: VolumeProcessingStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
