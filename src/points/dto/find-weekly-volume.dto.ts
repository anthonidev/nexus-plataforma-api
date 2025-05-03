import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/paginationDto';
import {
  PointTransactionStatus,
  PointTransactionType,
} from '../entities/points_transactions.entity';
import { VolumeProcessingStatus } from '../entities/weekly_volumes.entity';
import { ApiProperty } from '@nestjs/swagger';

export class FindPointsTransactionDto extends PaginationDto {
  @ApiProperty({ example: 'BINARY_COMMISSION', type: String, required: false })
  @IsOptional()
  @IsEnum(PointTransactionType)
  type?: PointTransactionType;

  @ApiProperty({ example: 'PENDING', type: String, required: false })
  @IsOptional()
  @IsEnum(PointTransactionStatus)
  status?: PointTransactionStatus;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class FindWeeklyVolumeDto extends PaginationDto {
  @ApiProperty({ example: 'PENDING', type: String, required: false })
  @IsOptional()
  @IsEnum(VolumeProcessingStatus)
  status?: VolumeProcessingStatus;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
