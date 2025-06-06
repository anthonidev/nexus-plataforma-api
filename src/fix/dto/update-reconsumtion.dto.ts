import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class UpdateMinimumReconsumptionDto {
  @ApiProperty({
    example: 217,
    type: Number,
    required: true,
    description: 'Nuevo monto mínimo de reconsumo para todas las membresías',
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto mínimo debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto mínimo no puede ser negativo' })
  @IsNotEmpty({ message: 'El monto mínimo de reconsumo es requerido' })
  @Type(() => Number)
  minimumReconsumptionAmount: number;
}
