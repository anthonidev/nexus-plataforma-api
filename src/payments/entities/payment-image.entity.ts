import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Payment } from './payment.entity';

@Entity('payment_images')
@Index(['payment', 'isActive'])
export class PaymentImage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Payment, (payment) => payment.images, { nullable: false })
  @JoinColumn({ name: 'payment_id' })
  @ValidateNested()
  @Type(() => Payment)
  @IsNotEmpty({ message: 'El pago es requerido' })
  payment: Payment;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'La URL de la imagen es requerida' })
  @MaxLength(500, { message: 'La URL no puede exceder los 500 caracteres' })
  url: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: 'El public_id de Cloudinary no puede exceder los 200 caracteres',
  })
  cloudinaryPublicId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido con hasta 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  amount: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'El nombre del banco no puede exceder los 100 caracteres',
  })
  bankName: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'La referencia de transacción es requerida' })
  @MaxLength(100, {
    message: 'La referencia no puede exceder los 100 caracteres',
  })
  transactionReference: string;

  @Column({ type: 'timestamp' })
  @IsDate({ message: 'La fecha de transacción debe ser válida' })
  @IsNotEmpty({ message: 'La fecha de transacción es requerida' })
  transactionDate: Date;

  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validateImage() {
    // Validar que la fecha de transacción no sea futura
    const now = new Date();
    if (this.transactionDate > now) {
      throw new Error('La fecha de transacción no puede ser futura');
    }

    // Asegurar que la referencia de transacción no tenga espacios innecesarios
    if (this.transactionReference) {
      this.transactionReference = this.transactionReference.trim();
    }

    // Limpiar otros campos de texto

    if (this.bankName) {
      this.bankName = this.bankName.trim();
    }
  }
}
