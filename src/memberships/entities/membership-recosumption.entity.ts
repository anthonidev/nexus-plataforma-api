import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

export enum ReconsumptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

@Entity('membership_reconsumptions')
@Index(['membership', 'periodDate']) // Para consultas rápidas por período
export class MembershipReconsumption {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Membership, (membership) => membership.reconsumptions, {
    nullable: false,
  })
  @JoinColumn({ name: 'membership_id' })
  @ValidateNested()
  @Type(() => Membership)
  @IsNotEmpty({ message: 'La membresía es requerida' })
  membership: Membership;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido con hasta 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  amount: number;

  @Column({ default: 'PENDING' })
  @IsEnum(ReconsumptionStatus, {
    message: 'El estado debe ser PENDING, ACTIVE o CANCELLED',
  })
  status: ReconsumptionStatus;

  @Column({ type: 'date' })
  @IsDate({ message: 'La fecha de período debe ser una fecha válida' })
  periodDate: Date;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  paymentReference: string;

  @Column({ type: 'json', nullable: true })
  @IsOptional()
  paymentDetails: Record<string, any>;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
