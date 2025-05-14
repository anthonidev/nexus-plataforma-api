import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class GetUserPointsDto {

  @ApiProperty({ example: 'Jose', type: String, required: false })
  @IsString()
  @IsOptional()
  term?: string;

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