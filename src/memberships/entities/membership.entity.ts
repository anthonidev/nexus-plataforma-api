import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { MembershipPlan } from './membership-plan.entity';
import { User } from 'src/user/entities/user.entity';
import { MembershipReconsumption } from './membership-reconsumption.entity';
import { MembershipUpgrade } from './membership-upgrade.entity';

@Entity('memberships')
export class Membership {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => MembershipPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: MembershipPlan;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ default: 'ACTIVE' })
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  paidAmount: number;

  @Column({ nullable: true })
  paymentReference: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 300 })
  minimumReconsumptionAmount: number;

  @Column({ type: 'date' })
  nextReconsumptionDate: Date;

  @OneToMany(
    () => MembershipReconsumption,
    (reconsumption) => reconsumption.membership,
  )
  reconsumptions: MembershipReconsumption[];

  @OneToMany(() => MembershipUpgrade, (upgrade) => upgrade.membership)
  upgrades: MembershipUpgrade[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
