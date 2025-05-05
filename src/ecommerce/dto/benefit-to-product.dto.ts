import { IsNotEmpty, IsString } from "class-validator";

export class BenefitToProductDto {
  @IsString()
  @IsNotEmpty({ message: 'El beneficio no debe estar vacío' })
  benefit: string;
}