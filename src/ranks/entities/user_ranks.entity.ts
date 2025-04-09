import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
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

@Entity('user_ranks')
@Index(['user'])
export class UserRank {
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
  @JoinColumn({ name: 'current_rank_id' })
  @ValidateNested()
  @Type(() => Rank)
  currentRank: Rank;

  @ManyToOne(() => Rank, { nullable: true })
  @JoinColumn({ name: 'highest_rank_id' })
  @ValidateNested()
  @Type(() => Rank)
  highestRank?: Rank;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
