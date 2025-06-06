import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MethodPayment } from 'src/payments/entities/payment.entity';

export class PaymentDetailDto {
  @ApiProperty({ example: 'Banco', type: String, required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  bankName?: string;

  @ApiProperty({ example: 'Banco', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'La referencia de transacción es requerida' })
  @Transform(({ value }) => value?.trim())
  transactionReference: string;

  @ApiProperty({ example: '2022-01-01', type: String, required: true })
  @IsDateString({}, { message: 'La fecha de transacción debe ser válida' })
  @IsNotEmpty({ message: 'La fecha de transacción es requerida' })
  transactionDate: string;

  @ApiProperty({ example: 100, type: Number, required: true })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido con hasta 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  @IsNotEmpty({ message: 'El monto del pago es requerido' })
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: 1, type: Number, required: true })
  @IsNumber()
  @IsNotEmpty({ message: 'El índice del archivo es requerido' })
  @Min(0, { message: 'El índice del archivo debe ser al menos 0' })
  @Type(() => Number)
  fileIndex: number;
}

export class CreateReconsumptionDto {

  @ApiProperty({ example: 2000, type: Number, required: true })
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

  @ApiProperty({ example: 'Banco', type: String, required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  paymentReference?: string;

  @ApiProperty({ example: 'VOUCHER', enum: MethodPayment, required: true })
  @IsEnum(MethodPayment, {
      message: 'El método de pago debe ser VOUCHER o POINTS',
  })
  @IsNotEmpty({ message: 'El método de pago es requerido' })
  methodPayment: MethodPayment;

  @ApiProperty({ example: null, type: String, required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  notes?: string;

  @ApiProperty({ example: PaymentDetailDto, type: Array, required: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
          ? plainToInstance(PaymentDetailDto, parsed)
          : [];
      } catch (error) {
        return [];
      }
    }
    return value;
  })
  @IsArray({ message: 'Los detalles de pago deben ser un arreglo' })
  @ValidateNested({
    each: true,
    message: 'Cada detalle de pago debe ser un objeto válido',
  })
  @IsOptional()
  @Type(() => PaymentDetailDto)
  payments?: PaymentDetailDto[];
}

export class UpdateAutoRenewalDto {
  @ApiProperty({ example: true, type: Boolean, required: true })
  @IsBoolean({ message: 'El valor de autoRenewal debe ser booleano' })
  autoRenewal: boolean;
}
