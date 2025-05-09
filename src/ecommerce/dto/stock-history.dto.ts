import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { StockActionType } from "../enums/stock-action-type.enum";

export class StockHistoryDto {
  @IsEnum(StockActionType, {
    message: 'El tipo de acción debe ser válido (INCREASE, DECREASE, UPDATE)',
  })
  actionType: string;

  @IsNumber()
  @Min(0, { message: 'La cantidad nueva no puede ser negativa' })
  quantity: number;

  @IsString()
  @IsOptional()
  description?: string;
}
