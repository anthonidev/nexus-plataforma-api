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

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del producto es requerido' })
  @MaxLength(200, {
    message: 'El nombre del producto no puede tener más de 200 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La descripción del producto es requerida' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El precio de socio debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El precio de socio no puede ser negativo' })
  @Type(() => Number)
  memberPrice?: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El precio público debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El precio público no puede ser negativo' })
  @Type(() => Number)
  publicPrice?: number;

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

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'El ID de la categoría debe ser positivo' })
  @Type(() => Number)
  categoryId?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;
}
export class UpdateImageDto {
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  order?: number;
}
