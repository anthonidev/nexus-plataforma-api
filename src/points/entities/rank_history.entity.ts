import { Type } from 'class-transformer';
import { IsDate, IsNumber, Min, ValidateNested } from 'class-validator';
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
import { Rank } from './ranks.entity';

@Entity('rank_history')
@Index(['user', 'periodDate']) // Optimizar consultas
export class RankHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  @ValidateNested()
  @Type(() => User)
  user: User;

  @ManyToOne(() => MembershipPlan, { nullable: true })
  @JoinColumn({ name: 'membership_plan_id' })
  @ValidateNested()
  @Type(() => MembershipPlan)
  membershipPlan?: MembershipPlan;

  @ManyToOne(() => Rank, { nullable: false })
  @JoinColumn({ name: 'rank_id' })
  @ValidateNested()
  @Type(() => Rank)
  rank: Rank;

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
    {
      message:
        'Los puntos alcanzados deben ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'Los puntos alcanzados no pueden ser negativos' })
  achievedPoints: number;

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
  @IsDate({ message: 'La fecha del período debe ser una fecha válida' })
  periodDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
