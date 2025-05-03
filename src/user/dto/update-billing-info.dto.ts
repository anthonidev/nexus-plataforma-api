import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateBillingInfoDto {
  @ApiProperty({ example: 'Av. Juan XXIII, 1', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'La dirección de facturación es requerida' })
  @MaxLength(200, {
    message: 'La dirección de facturación no puede tener más de 200 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  address: string;

  @ApiProperty({ example: '00051', type: String, required: false })
  @IsNumber()
  @IsOptional()
  ubigeoId?: number;
}
