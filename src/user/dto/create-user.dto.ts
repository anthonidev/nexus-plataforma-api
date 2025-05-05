import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'juan.perez@gmail.com', type: String, required: true })
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  @IsNotEmpty({ message: 'El correo es requerido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'Hola123', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{6,}$/, {
    message:
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
  })
  password: string;

  // Datos personales
  @ApiProperty({ example: 'Juan', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @ApiProperty({ example: 'Perez', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es requerido' })
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @ApiProperty({ example: '987654321', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El celular es requerido' })
  @Matches(/^[0-9+()-\s]+$/, {
    message:
      'El celular solo debe contener números, símbolos (+, -, ()) y espacios',
  })
  @Transform(({ value }) => value?.trim())
  phone: string;

  @ApiProperty({ example: '1990-01-01', type: String, required: true })
  @IsISO8601(
    {},
    {
      message:
        'La fecha de nacimiento debe tener un formato válido (YYYY-MM-DD)',
    },
  )
  @IsNotEmpty({ message: 'La fecha de nacimiento es requerida' })
  birthDate: string;

  @ApiProperty({ example: 'MASCULINO', type: String, required: true })
  @IsEnum(Gender, { message: 'El género debe ser MASCULINO, FEMENINO o OTRO' })
  @IsNotEmpty({ message: 'El género es requerido' })
  gender: string;

  // Ubicación
  @ApiProperty({ example: 1, type: Number, required: true })
  @ValidateNested()
  @Type(() => UbigeoDto)
  @IsNotEmpty({ message: 'El ubigeo es requerido' })
  ubigeo: UbigeoDto;

  // Sistema de referidos
  @ApiProperty({ example: null, type: String, required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  referrerCode?: string;

  @ApiProperty({ example: null, type: String, required: false })
  @IsEnum(['LEFT', 'RIGHT'], {
    message: 'La posición debe ser LEFT o RIGHT',
  })
  @IsOptional()
  position?: 'LEFT' | 'RIGHT';

  @ApiProperty({ example: 'CLI', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El rol es requerido' })
  roleCode: string;
}
