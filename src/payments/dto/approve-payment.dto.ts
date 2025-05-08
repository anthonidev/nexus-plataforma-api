import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApprovePaymentDto {

  @ApiProperty({ example: '123456789', type: String, required: true })
  @IsString()
  @IsOptional()
  codeOperation?: string;

  @ApiProperty({ example: 'Banco ABC', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del banco es requerido' })
  banckName: string;

  @ApiProperty({ example: '12-12-2024', type: String, required: true })
  @IsDateString(
    {},
    { message: 'La fecha de operación debe ser una fecha válida' },
  )
  @IsNotEmpty({ message: 'La fecha de operación es requerida' })
  dateOperation: string;

  @ApiProperty({ example: '123456789', type: String, required: true })
  @IsString()
  @IsOptional()
  numberTicket: string;
}
