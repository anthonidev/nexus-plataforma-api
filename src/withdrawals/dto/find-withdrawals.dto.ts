import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { WithdrawalStatus } from '../entities/withdrawal.entity';
import { ApiProperty } from '@nestjs/swagger';

export class FindWithdrawalsDto extends PaginationDto {
  @ApiProperty({ example: 'PENDING', type: String, required: false })
  @IsOptional()
  @IsEnum(WithdrawalStatus)
  status?: WithdrawalStatus;

  @ApiProperty({ example: '12-12-2024', type: String, required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '12-01-2025', type: String, required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: 'Jose', type: String, required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '123456789', type: String, required: false })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({ example: 'jose@gmail.com', type: String, required: false })
  @IsOptional()
  @IsString()
  email?: string;
}
