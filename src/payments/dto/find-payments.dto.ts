import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { PaymentStatus } from '../entities/payment.entity';
import { ApiProperty } from '@nestjs/swagger';

export class FindPaymentsDto extends PaginationDto {
  @ApiProperty({ example: 1, type: Number, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  paymentConfigId?: number;

  @ApiProperty({ example: 'PENDING', type: String, required: false })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: 'Juan', type: String, required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
