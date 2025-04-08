import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class ApprovePaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'El código de operación es requerido' })
  codeOperation: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del banco es requerido' })
  banckName: string;

  @IsDateString(
    {},
    { message: 'La fecha de operación debe ser una fecha válida' },
  )
  @IsNotEmpty({ message: 'La fecha de operación es requerida' })
  dateOperation: string;

  @IsString()
  @IsNotEmpty({ message: 'El número de ticket es requerido' })
  numberTicket: string;
}
