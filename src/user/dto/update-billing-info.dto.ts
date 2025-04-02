import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateBillingInfoDto {
  @IsString()
  @IsNotEmpty({ message: 'La dirección de facturación es requerida' })
  @MaxLength(200, {
    message: 'La dirección de facturación no puede tener más de 200 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  address: string;

  @IsNumber()
  @IsOptional()
  ubigeoId?: number;
}
