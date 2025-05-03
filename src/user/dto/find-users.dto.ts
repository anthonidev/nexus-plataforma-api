import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { ApiProperty } from '@nestjs/swagger';
export class FindUsersDto extends PaginationDto {
  @ApiProperty({ example: 'juan', type: String, required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ example: true, type: Boolean, required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
