import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
export class PaginationDto {
  @ApiProperty({ example: 1, type: Number, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;
  @ApiProperty({ example: 10, type: Number, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;
  @ApiProperty({ example: 'ASC', type: String, required: false })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';
}
