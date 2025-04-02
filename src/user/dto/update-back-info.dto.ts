import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateBankInfoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del banco es requerido' })
  @MaxLength(100, {
    message: 'El nombre del banco no puede tener más de 100 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  bankName: string;

  @IsString()
  @IsNotEmpty({ message: 'El número de cuenta es requerido' })
  @MaxLength(30, {
    message: 'El número de cuenta no puede tener más de 30 caracteres',
  })
  @Matches(/^[0-9-]+$/, {
    message: 'El número de cuenta solo debe contener números y guiones',
  })
  @Transform(({ value }) => value?.trim())
  accountNumber: string;

  @IsString()
  @IsOptional()
  @MaxLength(30, { message: 'El CCI no puede tener más de 30 caracteres' })
  @Matches(/^[0-9-]+$/, {
    message: 'El CCI solo debe contener números y guiones',
  })
  @Transform(({ value }) => value?.trim())
  cci?: string;
}
