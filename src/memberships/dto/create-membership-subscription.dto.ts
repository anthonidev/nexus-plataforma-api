import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class PaymentImageDto {
  @IsString()
  @IsNotEmpty({ message: 'La URL de la imagen es requerida' })
  url: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido con hasta 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  amount: number;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsNotEmpty({ message: 'La referencia de transacción es requerida' })
  transactionReference: string;

  @IsDateString({}, { message: 'La fecha de transacción debe ser válida' })
  @IsNotEmpty({ message: 'La fecha de transacción es requerida' })
  transactionDate: string;
}

export class CreateMembershipSubscriptionDto {
  @IsNumber()
  @IsNotEmpty({ message: 'El ID del plan es requerido' })
  planId: number;

  @IsString()
  @IsOptional()
  paymentReference?: string;

  @ValidateNested()
  @Type(() => PaymentImageDto)
  @IsNotEmpty({ message: 'La información de pago es requerida' })
  paymentImage: PaymentImageDto;

  @IsString()
  @IsOptional()
  notes?: string;
}
