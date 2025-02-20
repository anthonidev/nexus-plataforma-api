import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

@Entity('membership_reconsumptions')
export class MembershipReconsumption {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Membership)
  @JoinColumn({ name: 'membership_id' })
  membership: Membership;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED';

  @Column({ type: 'date' })
  periodDate: Date;

  @Column({ nullable: true })
  paymentReference: string;

  @CreateDateColumn()
  createdAt: Date;
}
