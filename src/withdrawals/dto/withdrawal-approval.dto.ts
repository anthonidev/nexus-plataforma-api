import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class ApproveWithdrawalDto {
  @ApiProperty({ example: '12212AAS', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El código de operación es requerido' })
  codeOperation: string;

  @ApiProperty({ example: 'Banco', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del banco es requerido' })
  banckNameApproval: string;

  @ApiProperty({ example: '12-12-2024', type: String, required: true })
  @IsDateString(
    {},
    { message: 'La fecha de operación debe ser una fecha válida' },
  )
  @IsNotEmpty({ message: 'La fecha de operación es requerida' })
  dateOperation: string;

  @ApiProperty({ example: '12221212', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El número de ticket es requerido' })
  numberTicket: string;
}

export class RejectWithdrawalDto {
  @ApiProperty({ example: 'Transferencia rechazada', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'La razón de rechazo es requerida' })
  rejectionReason: string;
}
