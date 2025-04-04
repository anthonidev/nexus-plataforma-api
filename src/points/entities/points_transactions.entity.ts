export class Point {}
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum PointTransactionType {
  BINARY_COMMISSION = 'BINARY_COMMISSION',
  DIRECT_BONUS = 'DIRECT_BONUS',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum PointTransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

@Entity('points_transactions')
export class PointsTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  @ValidateNested()
  @Type(() => User)
  user: User;

  @Column({
    type: 'enum',
    enum: PointTransactionType,
  })
  @IsEnum(PointTransactionType, {
    message: 'Tipo de transacción de puntos inválido',
  })
  type: PointTransactionType;

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

  @Column({
    type: 'enum',
    enum: PointTransactionStatus,
    default: PointTransactionStatus.PENDING,
  })
  @IsEnum(PointTransactionStatus, {
    message: 'Estado de transacción de puntos inválido',
  })
  status: PointTransactionStatus;

  @ManyToOne(() => MembershipPlan, { nullable: true })
  @JoinColumn({ name: 'membership_plan_id' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MembershipPlan)
  membershipPlan?: MembershipPlan;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
