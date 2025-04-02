import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PaymentStatus } from '../entities/payment.entity';
import { PaginationDto } from 'src/common/dto/paginationDto';

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
  @IsDateString()
  endDate?: string;
}
