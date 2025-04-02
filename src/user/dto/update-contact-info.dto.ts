import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateContactInfoDto {
  @IsString()
  @IsOptional()
  @MaxLength(20, {
    message: 'El número de teléfono no puede tener más de 20 caracteres',
  })
  @Matches(/^[0-9+()-\s]+$/, {
    message:
      'El número de teléfono solo debe contener números, símbolos (+, -, ()) y espacios',
  })
  @Transform(({ value }) => value?.trim())
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200, {
    message: 'La dirección no puede tener más de 200 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10, {
    message: 'El código postal no puede tener más de 10 caracteres',
  })
  @Matches(/^[a-zA-Z0-9-\s]+$/, {
    message:
      'El código postal solo debe contener letras, números, guiones y espacios',
  })
  @Transform(({ value }) => value?.trim())
  postalCode?: string;

  @IsNumber()
  @IsOptional()
  ubigeoId?: number;
}
