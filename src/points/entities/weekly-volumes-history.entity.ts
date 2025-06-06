import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WeeklyVolume } from './weekly_volumes.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export enum VolumeSide {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

@Entity('weekly_volumes_history')
export class WeeklyVolumesHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WeeklyVolume, (weeklyVolume) => weeklyVolume.history)
  @JoinColumn({ name: 'weekly_volume_id' })
  weeklyVolumes: WeeklyVolume;

  @ManyToOne(() => Payment, (payment) => payment.weeklyVolumesHistory)
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({
    type: 'enum',
    enum: VolumeSide,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(VolumeSide, {
    message: 'Lado de volumen inválido. Debe ser LEFT o RIGHT',
  })
  selectedSide: VolumeSide;

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
      message: 'El volumen debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El volumen no puede ser negativo' })
  volume: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
