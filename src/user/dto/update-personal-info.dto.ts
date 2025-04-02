import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

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
}
