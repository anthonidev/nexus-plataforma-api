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
} from 'typeorm';

export enum VolumeProcessingStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  CANCELLED = 'CANCELLED',
}

export enum VolumeSide {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

@Entity('weekly_volumes')
@Index(['user', 'weekStartDate']) // Optimizar consultas
export class WeeklyVolume {
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

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
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

  @Column({ type: 'date' })
  @IsDate({ message: 'La fecha de inicio de semana debe ser una fecha válida' })
  weekStartDate: Date;

  @Column({ type: 'date' })
  @IsDate({ message: 'La fecha de fin de semana debe ser una fecha válida' })
  weekEndDate: Date;

  @Column({
    type: 'enum',
    enum: VolumeProcessingStatus,
    default: VolumeProcessingStatus.PENDING,
  })
  @IsEnum(VolumeProcessingStatus, {
    message: 'Estado de procesamiento de volumen inválido',
  })
  status: VolumeProcessingStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto pagado debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto pagado no puede ser negativo' })
  paidAmount?: number;

  @Column({
    type: 'enum',
    enum: VolumeSide,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(VolumeSide, {
    message: 'Lado de volumen inválido. Debe ser LEFT o RIGHT',
  })
  selectedSide?: VolumeSide;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El volumen trasladado debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El volumen trasladado no puede ser negativo' })
  carryOverVolume: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;
}
