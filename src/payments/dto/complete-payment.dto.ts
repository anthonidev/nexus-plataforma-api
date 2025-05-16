import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CompletePaymentDto {

  @ApiProperty({ example: '123456789', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El código de operación es requerido' })
  codeOperation?: string;

  @ApiProperty({ example: '123456789', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El número de ticket es requerido' })
  numberTicket?: string;


}