import { Type } from 'class-transformer';
import {
  IsDate,
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
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Rank } from './ranks.entity';

export enum MonthlyVolumeStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  CANCELLED = 'CANCELLED',
}

@Entity('monthly_volume_ranks')
@Index(['user', 'monthStartDate'])
export class MonthlyVolumeRank {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  @ValidateNested()
  @Type(() => User)
  user: User;

  @ManyToOne(() => MembershipPlan, { nullable: true })
  @JoinColumn({ name: 'membership_plan_id' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MembershipPlan)
  membershipPlan?: MembershipPlan;

  @ManyToOne(() => Rank, { nullable: true })
  @JoinColumn({ name: 'assigned_rank_id' })
  @IsOptional()
  @ValidateNested()
  @Type(() => Rank)
  assignedRank?: Rank;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El volumen total debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El volumen total no puede ser negativo' })
  totalVolume: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El volumen izquierdo debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El volumen izquierdo no puede ser negativo' })
  leftVolume: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El volumen derecho debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El volumen derecho no puede ser negativo' })
  rightVolume: number;

  @Column({
    type: 'int',
    default: 0,
  })
  @IsNumber(
    {},
    { message: 'Los directos izquierdos deben ser un número entero' },
  )
  @Min(0, { message: 'Los directos izquierdos no pueden ser negativos' })
  leftDirects: number;

  @Column({
    type: 'int',
    default: 0,
  })
  @IsNumber({}, { message: 'Los directos derechos deben ser un número entero' })
  @Min(0, { message: 'Los directos derechos no pueden ser negativos' })
  rightDirects: number;

  @Column({ type: 'date' })
  @IsDate({ message: 'La fecha de inicio de mes debe ser una fecha válida' })
  monthStartDate: Date;

  @Column({ type: 'date' })
  @IsDate({ message: 'La fecha de fin de mes debe ser una fecha válida' })
  monthEndDate: Date;

  @Column({
    type: 'enum',
    enum: MonthlyVolumeStatus,
    default: MonthlyVolumeStatus.PENDING,
  })
  @IsEnum(MonthlyVolumeStatus, {
    message: 'Estado de procesamiento de volumen mensual inválido',
  })
  status: MonthlyVolumeStatus;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
