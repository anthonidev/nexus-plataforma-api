import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Membership } from './membership.entity';
import { MembershipPlan } from './membership-plan.entity';

@Entity('membership_upgrades')
export class MembershipUpgrade {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Membership)
  @JoinColumn({ name: 'membership_id' })
  membership: Membership;

  @ManyToOne(() => MembershipPlan)
  @JoinColumn({ name: 'from_plan_id' })
  fromPlan: MembershipPlan;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';

  @ManyToOne(() => MembershipPlan)
  @JoinColumn({ name: 'to_plan_id' })
  toPlan: MembershipPlan;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  upgradeCost: number;

  @Column({ nullable: true })
  paymentReference: string;

  @CreateDateColumn()
  createdAt: Date;
}
