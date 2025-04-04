import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { User } from 'src/user/entities/user.entity';
import {
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
import { PointsTransaction } from './points_transactions.entity';

@Entity('user_points')
@Index(['user']) // Optimizar consultas
export class UserPoints {
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
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'Los puntos disponibles deben ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'Los puntos disponibles no pueden ser negativos' })
  availablePoints: number;

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
        'Los puntos totales ganados deben ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'Los puntos totales ganados no pueden ser negativos' })
  totalEarnedPoints: number;

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
        'Los puntos retirados deben ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'Los puntos retirados no pueden ser negativos' })
  totalWithdrawnPoints: number;

  @OneToMany(() => PointsTransaction, (transaction) => transaction.user)
  transactions: PointsTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
