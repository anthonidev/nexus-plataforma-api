import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('withdrawals')
@Index(['user', 'status'])
@Index(['createdAt'])
export class Withdrawal {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  @ValidateNested()
  @Type(() => User)
  @IsNotEmpty({ message: 'El usuario es requerido' })
  user: User;

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
  @IsEnum(WithdrawalStatus, {
    message: 'El estado debe ser PENDING, APPROVED o REJECTED',
  })
  status: WithdrawalStatus;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'La razón de rechazo no puede exceder los 255 caracteres',
  })
  rejectionReason: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  codeOperation: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  banckNameApproval: string;

  @Column({ nullable: true, type: 'timestamp' })
  @IsOptional()
  @IsDate()
  dateOperation: Date;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  numberTicket: string;

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

  // Detalles bancarios para el retiro
  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del banco es requerido' })
  @MaxLength(100, {
    message: 'El nombre del banco no puede tener más de 100 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  bankName: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El número de cuenta es requerido' })
  @MaxLength(30, {
    message: 'El número de cuenta no puede tener más de 30 caracteres',
  })
  @Matches(/^[0-9-]+$/, {
    message: 'El número de cuenta solo debe contener números y guiones',
  })
  @Transform(({ value }) => value?.trim())
  accountNumber: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El CCI no puede tener más de 30 caracteres' })
  @Matches(/^[0-9-]+$/, {
    message: 'El CCI solo debe contener números y guiones',
  })
  @Transform(({ value }) => value?.trim())
  cci: string;

  // Metadatos adicionales
  @Column({ type: 'json', nullable: true })
  @IsOptional()
  metadata: Record<string, any>;

  @BeforeInsert()
  @BeforeUpdate()
  validateWithdrawal() {
    // Si el retiro está rechazado, debe haber una razón
    if (this.status === WithdrawalStatus.REJECTED && !this.rejectionReason) {
      throw new Error('Se requiere una razón para rechazar el retiro');
    }

    // Si el retiro está aprobado o rechazado, debe tener reviewedBy y reviewedAt
    if (
      (this.status === WithdrawalStatus.APPROVED ||
        this.status === WithdrawalStatus.REJECTED) &&
      (!this.reviewedBy || !this.reviewedAt)
    ) {
      throw new Error(
        'Los retiros aprobados o rechazados requieren revisor y fecha de revisión',
      );
    }

    // Si el retiro está aprobado, debe tener información de transferencia
  }
}
