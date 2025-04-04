import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsDate,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { User } from 'src/user/entities/user.entity';
import { PaymentConfig } from './payment-config.entity';
import { PaymentImage } from './payment-image.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('payments')
@Index(['user', 'paymentConfig'])
@Index(['status', 'createdAt'])
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  @ValidateNested()
  @Type(() => User)
  @IsNotEmpty({ message: 'El usuario es requerido' })
  user: User;

  @ManyToOne(() => PaymentConfig, { nullable: false })
  @JoinColumn({ name: 'payment_config_id' })
  @ValidateNested()
  @Type(() => PaymentConfig)
  @IsNotEmpty({ message: 'La configuración de pago es requerida' })
  paymentConfig: PaymentConfig;

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

  @Column()
  @IsEnum(PaymentStatus, {
    message: 'El estado debe ser PENDING, APPROVED o REJECTED',
  })
  status: PaymentStatus;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'La razón de rechazo no puede exceder los 255 caracteres',
  })
  rejectionReason: string;

  @OneToMany(() => PaymentImage, (image) => image.payment, { cascade: true })
  images: PaymentImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  @IsOptional()
  @ValidateNested()
  @Type(() => User)
  reviewedBy: User;

  @Column({ nullable: true, type: 'timestamp' })
  @IsOptional()
  @IsDate()
  reviewedAt: Date;

  @Column({ default: false })
  @IsBoolean()
  isArchived: boolean;

  // Relación con la entidad a la que pertenece este pago (opcional)
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  relatedEntityType: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  relatedEntityId: number;

  // Metadatos adicionales (pueden ser útiles para guardar info específica del tipo de pago)
  @Column({ type: 'json', nullable: true })
  @IsOptional()
  metadata: Record<string, any>;

  // Campos para registro de transacciones
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  transactionId: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  paymentMethod: string;

  @BeforeInsert()
  @BeforeUpdate()
  validatePayment() {
    // Si el pago está rechazado, debe haber una razón
    if (this.status === PaymentStatus.REJECTED && !this.rejectionReason) {
      throw new Error('Se requiere una razón para rechazar el pago');
    }

    // Si el pago está aprobado o rechazado, debe tener reviewedBy y reviewedAt
    if (
      (this.status === PaymentStatus.APPROVED ||
        this.status === PaymentStatus.REJECTED) &&
      (!this.reviewedBy || !this.reviewedAt)
    ) {
      throw new Error(
        'Los pagos aprobados o rechazados requieren revisor y fecha de revisión',
      );
    }
  }
}
