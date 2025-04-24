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

export class FindPaymentsDto extends PaginationDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  paymentConfigId?: number;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
