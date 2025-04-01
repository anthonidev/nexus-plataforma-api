import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// DTO para la información de cada pago individual
export class PaymentDetailDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  bankName?: string;

  @IsString()
  @IsNotEmpty({ message: 'La referencia de transacción es requerida' })
  @Transform(({ value }) => value?.trim())
  transactionReference: string;

  @IsDateString({}, { message: 'La fecha de transacción debe ser válida' })
  @IsNotEmpty({ message: 'La fecha de transacción es requerida' })
  transactionDate: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido con hasta 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  @IsNotEmpty({ message: 'El monto del pago es requerido' })
  @Type(() => Number)
  amount: number;

  @IsNumber()
  @IsNotEmpty({ message: 'El índice del archivo es requerido' })
  @Min(0, { message: 'El índice del archivo debe ser al menos 0' })
  @Type(() => Number)
  fileIndex: number;
}

export class CreateMembershipSubscriptionDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty({ message: 'El ID del plan es requerido' })
  planId: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'El monto total debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto total no puede ser negativo' })
  @IsNotEmpty({ message: 'El monto total del pago es requerido' })
  @Type(() => Number)
  totalAmount: number;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  paymentReference?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDetailDto)
  payments: PaymentDetailDto[];
}
