import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdatePersonalInfoDto {
  @IsString()
  @IsOptional()
  @MaxLength(20, {
    message: 'El número de documento no puede tener más de 20 caracteres',
  })
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message:
      'El número de documento solo debe contener letras, números y guiones',
  })
  @Transform(({ value }) => value?.trim())
  documentNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, {
    message: 'El apodo no puede tener más de 50 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  nickname?: string;

  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;
}
