import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('withdrawal_configs')
export class WithdrawalConfig {
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

  // Monto mínimo de retiro
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 50,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto mínimo debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto mínimo no puede ser negativo' })
  minimumAmount: number;

  // Monto máximo de retiro
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

  // Hora de inicio del rango diario para hacer retiros (formato 24h, 0-23)
  @Column({ default: 9 })
  @IsInt()
  @Min(0, { message: 'La hora de inicio debe ser entre 0 y 23' })
  startHour: number;

  // Hora de fin del rango diario para hacer retiros (formato 24h, 0-23)
  @Column({ default: 18 })
  @IsInt()
  @Min(0, { message: 'La hora de fin debe ser entre 0 y 23' })
  endHour: number;

  // Días de la semana habilitados para retiros (array con números del 0-6, donde 0 es domingo)
  @Column('int', { array: true, default: [1, 2, 3, 4, 5] })
  enabledWeekDays: number[];

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

    // Validar rango de horas
    if (this.startHour < 0 || this.startHour > 23) {
      throw new Error('La hora de inicio debe estar entre 0 y 23');
    }

    if (this.endHour < 0 || this.endHour > 23) {
      throw new Error('La hora de fin debe estar entre 0 y 23');
    }

    if (this.endHour <= this.startHour) {
      throw new Error('La hora de fin debe ser posterior a la hora de inicio');
    }

    // Validar días de la semana
    if (this.enabledWeekDays && this.enabledWeekDays.length > 0) {
      for (const day of this.enabledWeekDays) {
        if (day < 0 || day > 6) {
          throw new Error('Los días de la semana deben estar entre 0 y 6');
        }
      }
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
