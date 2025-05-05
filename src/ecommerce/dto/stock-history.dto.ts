import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { Column } from "typeorm";
import { StockActionType } from "../enums/stock-action-type.enum";

export class StockHistoryDto {

  @IsEnum(StockActionType, {
    message: 'El tipo de acción debe ser válido (INCREASE, DECREASE, UPDATE)',
  })
  actionType: string;

  @IsNumber()
  @Min(0, { message: 'La cantidad previa no puede ser negativa' })
  previousQuantity: number;

  @IsNumber()
  @Min(0, { message: 'La cantidad nueva no puede ser negativa' })
  newQuantity: number;

  @IsNumber()
  @Min(0, { message: 'La cantidad modificada no puede ser negativa' })
  quantityChanged: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsUUID()
  @IsNotEmpty({ message: 'El ID del usuario es requerido' })
  userId: string;
}
