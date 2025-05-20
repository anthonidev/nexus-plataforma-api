import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class AddPointsDto {
    @ApiProperty({ example: 'juan.perez@gmail.com', type: String, required: true })
    @IsEmail({}, { message: 'El correo debe tener un formato válido' })
    @IsNotEmpty({ message: 'El correo es requerido' })
    email: string;

    @ApiProperty({ example: 50, type: Number, required: true })
    @IsNumber(
        { maxDecimalPlaces: 2 },
        { message: 'El monto debe ser un número válido con hasta 2 decimales' }
    )
    @Min(0, { message: 'El monto no puede ser negativo' })
    @IsNotEmpty({ message: 'El monto es requerido' })
    amount: number;

    @ApiProperty({ example: 'Bono por promoción', type: String, required: true })
    @IsString()
    @IsNotEmpty({ message: 'El motivo es requerido' })
    reason: string;
}