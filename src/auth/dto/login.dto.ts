import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
export class LoginDto {
  @ApiProperty({ example: 'juan.perez@gmail.com', type: String, required: true })
  @IsString()
  email: string;

  @ApiProperty({ example: 'Hola123', type: String, required: true })
  @IsString()
  @MinLength(6)
  password: string;
}
