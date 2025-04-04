import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Payment } from './payment.entity';

@Entity('payment_configs')
export class PaymentConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @IsString()
  @IsNotEmpty({ message: 'El código es requerido' })
  @MaxLength(50, { message: 'El código no puede exceder los 50 caracteres' })
  @Matches(/^[A-Z0-9_]+$/, {
    message:
      'El código solo debe contener letras mayúsculas, números y guiones bajos',
  })
  @Transform(({ value }) => value?.toUpperCase().trim())
  code: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'La descripción no puede exceder los 500 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  description: string;

  @Column({ default: true })
  @IsBoolean({
    message: 'El campo requiresApproval debe ser un valor booleano',
  })
  requiresApproval: boolean;

  @Column({ default: true })
  @IsBoolean({ message: 'El campo isActive debe ser un valor booleano' })
  isActive: boolean;

  // Añadimos un campo para el monto mínimo de pago
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto mínimo debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto mínimo no puede ser negativo' })
  minimumAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto máximo debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto máximo no puede ser negativo' })
  maximumAmount: number;

  @OneToMany(() => Payment, (payment) => payment.paymentConfig)
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validateConfig() {
    // Validar que si existe monto máximo, sea mayor que el mínimo
    if (
      this.minimumAmount !== null &&
      this.minimumAmount !== undefined &&
      this.maximumAmount !== null &&
      this.maximumAmount !== undefined &&
      this.maximumAmount < this.minimumAmount
    ) {
      throw new Error(
        'El monto máximo debe ser mayor o igual que el monto mínimo',
      );
    }

    // Normalizar código a mayúsculas
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }

    // Normalizar campos de texto
    if (this.name) {
      this.name = this.name.trim();
    }

    if (this.description) {
      this.description = this.description.trim();
    }
  }
}
