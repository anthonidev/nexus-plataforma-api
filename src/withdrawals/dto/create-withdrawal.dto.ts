import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: 1200, type: Number, required: true })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido con hasta 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  @IsNotEmpty({ message: 'El monto es requerido' })
  @Type(() => Number)
  amount: number;
}
