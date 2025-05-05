import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DirectActivationDto {
  @ApiProperty({ example: 'juan.perez@gmail.com', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El correo es requerido' })
  email: string;

  @ApiProperty({ example: 'VIP', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El código del plan es requerido' })
  planCode: string;
}
