import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

enum Gender {
  MASCULINO = 'MASCULINO',
  FEMENINO = 'FEMENINO',
  OTRO = 'OTRO',
}

class UbigeoDto {
  @IsNotEmpty({ message: 'El ID del ubigeo es requerido' })
  id: number;
}

export class RegisterDto {
  // Datos básicos de la cuenta
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  @IsNotEmpty({ message: 'El correo es requerido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{6,}$/, {
    message:
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
  })
  password: string;

  // Datos personales
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es requerido' })
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @IsString()
  @IsNotEmpty({ message: 'El celular es requerido' })
  @Matches(/^[0-9+()-\s]+$/, {
    message:
      'El celular solo debe contener números, símbolos (+, -, ()) y espacios',
  })
  @Transform(({ value }) => value?.trim())
  phone: string;

  @IsISO8601(
    {},
    {
      message:
        'La fecha de nacimiento debe tener un formato válido (YYYY-MM-DD)',
    },
  )
  @IsNotEmpty({ message: 'La fecha de nacimiento es requerida' })
  birthDate: string;

  @IsEnum(Gender, { message: 'El género debe ser MASCULINO, FEMENINO o OTRO' })
  @IsNotEmpty({ message: 'El género es requerido' })
  gender: string;

  // Ubicación
  @ValidateNested()
  @Type(() => UbigeoDto)
  @IsNotEmpty({ message: 'El ubigeo es requerido' })
  ubigeo: UbigeoDto;

  // Sistema de referidos
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  referrerCode?: string;

  @IsEnum(['LEFT', 'RIGHT'], {
    message: 'La posición debe ser LEFT o RIGHT',
  })
  @IsOptional()
  position?: 'LEFT' | 'RIGHT';

  @IsNotEmpty({ message: 'El rol es requerido' })
  roleId: number;
}
