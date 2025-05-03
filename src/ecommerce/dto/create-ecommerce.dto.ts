import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Colágeno Renew', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del producto es requerido' })
  @MaxLength(200, {
    message: 'El nombre del producto no puede tener más de 200 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'Colágeno Renew para la persona que no tiene un colágeno', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'La descripción del producto es requerida' })
  @Transform(({ value }) => value?.trim())
  description: string;

  @ApiProperty({ example: 15.20, type: Number, required: true })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El precio de socio debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El precio de socio no puede ser negativo' })
  @Type(() => Number)
  memberPrice: number;

  @ApiProperty({ example: 15.20, type: Number, required: true })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El precio público debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El precio público no puede ser negativo' })
  @Type(() => Number)
  publicPrice: number;

  @ApiProperty({ example: 15, type: Number, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  @Type(() => Number)
  stock?: number;


  @ApiProperty({ example: null, type: String, required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }
    return value;
  })
  benefits?: string[];

  @ApiProperty({ example: 1, type: Number, required: true })
  @IsNumber()
  @IsPositive({ message: 'El ID de la categoría debe ser positivo' })
  @Type(() => Number)
  categoryId: number;

  @ApiProperty({ example: true, type: Boolean, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean = true;
}
