import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { User } from 'src/user/entities/user.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentConfig } from './payment-config.entity';
import { PaymentImage } from './payment-image.entity';
import { WeeklyVolumesHistory } from 'src/points/entities/weekly-volumes-history.entity';
import { PointsTransactionPayment } from 'src/points/entities/points-transactions-payments.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum MethodPayment {
  VOUCHER = 'VOUCHER',
  POINTS = 'POINTS',
  PAYMENT_GATEWAY = 'PAYMENT_GATEWAY',
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

  @Column({ default: MethodPayment.VOUCHER })
  @IsEnum(MethodPayment, {
    message: 'El método de pago debe ser VOUCHER, POINTS o PAYMENT_GATEWAY',
  })
  methodPayment: MethodPayment;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  codeOperation: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  banckName: string;

  @Column({ nullable: true, type: 'timestamp' })
  @IsOptional()
  @IsDate()
  dateOperation: Date;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  numberTicket: string;

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

  @OneToMany(
    () => WeeklyVolumesHistory,
    (weeklyVolumesHistory) => weeklyVolumesHistory.payment,
  )
  weeklyVolumesHistory: WeeklyVolumesHistory[];

  @Column({ nullable: true, type: 'timestamp' })
  @IsOptional()
  @IsDate()
  reviewedAt: Date;

  @Column({ default: false })
  @IsBoolean()
  isArchived: boolean;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  relatedEntityType: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  relatedEntityId: number;

  @OneToMany(
    () => PointsTransactionPayment,
    (pointsTransactionPayment) => pointsTransactionPayment.payment,
  )
  pointsTransactionsPayments: PointsTransactionPayment[];

  @Column({ type: 'json', nullable: true })
  @IsOptional()
  metadata: Record<string, any>;

  @BeforeInsert()
  @BeforeUpdate()
  validatePayment() {
    if (this.status === PaymentStatus.REJECTED && !this.rejectionReason) {
      throw new Error('Se requiere una razón para rechazar el pago');
    }

    // if (
    //   (this.status === PaymentStatus.APPROVED ||
    //     this.status === PaymentStatus.REJECTED) &&
    //   (!this.reviewedBy || !this.reviewedAt)
    // ) {
    //   throw new Error(
    //     'Los pagos aprobados o rechazados requieren revisor y fecha de revisión',
    //   );
    // }
  }
}
