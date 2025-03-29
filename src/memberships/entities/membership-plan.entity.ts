import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

@Entity('membership_plans')
export class MembershipPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del plan es requerido' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número válido con hasta 2 decimales' },
  )
  @Min(0, { message: 'El precio no puede ser negativo' })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto de cheque debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto de cheque no puede ser negativo' })
  checkAmount: number;

  @Column({ type: 'int' })
  @IsNumber({}, { message: 'Los puntos binarios deben ser un número válido' })
  @Min(0, { message: 'Los puntos binarios no pueden ser negativos' })
  binaryPoints: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El porcentaje de comisión debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El porcentaje de comisión no puede ser negativo' })
  commissionPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto de comisión directa debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto de comisión directa no puede ser negativo' })
  directCommissionAmount: number;

  @Column('text', { array: true })
  @IsArray({ message: 'Los productos deben ser una lista' })
  products: string[];

  @Column('text', { array: true })
  @IsArray({ message: 'Los beneficios deben ser una lista' })
  benefits: string[];

  @Column({ default: true })
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  @IsNumber()
  @Min(0, { message: 'El orden no puede ser negativo' })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Membership, (membership) => membership.plan)
  memberships: Membership[];

  @BeforeInsert()
  @BeforeUpdate()
  trimFields() {
    if (this.name) {
      this.name = this.name.trim();
    }

    // Asegurar que los arrays no tengan elementos vacíos
    if (this.products) {
      this.products = this.products.filter(
        (product) => product && product.trim().length > 0,
      );
    }

    if (this.benefits) {
      this.benefits = this.benefits.filter(
        (benefit) => benefit && benefit.trim().length > 0,
      );
    }
  }
}
