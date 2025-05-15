import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "src/common/dto/paginationDto";
import { OrderStatus } from "../enums/orders-status.enum";

export class FindAllOrdersClientDto extends PaginationDto {

  @ApiProperty({ example: 'PENDING', type: String, required: false })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2024-12-12', type: String, required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}