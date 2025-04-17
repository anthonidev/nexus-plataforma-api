import { IsNotEmpty, IsString } from 'class-validator';

export class DirectActivationDto {
  @IsString()
  @IsNotEmpty({ message: 'El correo es requerido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El código del plan es requerido' })
  planCode: string;
}
