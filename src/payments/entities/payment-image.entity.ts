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
import {
  PointsTransaction,
  PointTransactionType,
} from 'src/points/entities/points_transactions.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Payment } from './payment.entity';

// Modificación para payment-image.entity.ts
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

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La URL no puede exceder los 500 caracteres' })
  url?: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: 'El public_id de Cloudinary no puede exceder los 200 caracteres',
  })
  cloudinaryPublicId?: string;

  @ManyToOne(() => PointsTransaction, { nullable: true })
  @JoinColumn({ name: 'points_transaction_id' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PointsTransaction)
  pointsTransaction?: PointsTransaction;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
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

    // Validar que si no hay url/cloudinaryPublicId, debe haber un pointsTransaction
    if ((!this.url || !this.cloudinaryPublicId) && !this.pointsTransaction) {
      throw new Error(
        'Debe proporcionar una imagen o una transacción de puntos',
      );
    }

    // Validar que el tipo de pointsTransaction sea válido
    // if (this.pointsTransaction) {
    //   console.log("TYPE", this.pointsTransaction.type);
    //   if (
    //     this.pointsTransaction.type !== PointTransactionType.BINARY_COMMISSION &&
    //     this.pointsTransaction.type !== PointTransactionType.DIRECT_BONUS
    //   ) {
    //     throw new Error(
    //       'La transacción de puntos debe ser de tipo BINARY_COMMISSION o DIRECT_BONUS'
    //     );
    //   }
    // }
  }
}
