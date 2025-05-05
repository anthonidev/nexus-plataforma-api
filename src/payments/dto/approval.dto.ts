import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPaymentDto {
  @ApiProperty({ example: 'No se pudo realizar la operación', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'La razón de rechazo es requerida' })
  rejectionReason: string;
}
