import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'La razón de rechazo es requerida' })
  rejectionReason: string;
}
