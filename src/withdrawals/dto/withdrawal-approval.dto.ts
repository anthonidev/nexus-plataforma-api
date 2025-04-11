import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class ApproveWithdrawalDto {
  @IsString()
  @IsNotEmpty({ message: 'El código de operación es requerido' })
  codeOperation: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del banco es requerido' })
  banckNameApproval: string;

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

export class RejectWithdrawalDto {
  @IsString()
  @IsNotEmpty({ message: 'La razón de rechazo es requerida' })
  rejectionReason: string;
}
