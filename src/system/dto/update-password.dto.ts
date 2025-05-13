import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdatePasswordDto {
  @ApiProperty({ example: 'juan.perez@gmail.com', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'El correo es requerido' })
  email: string;

  @ApiProperty({ example: '12345678', type: String, required: true })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  newPassword: string;
}