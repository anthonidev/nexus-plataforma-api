import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

@Entity('membership_history')
export class MembershipHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Membership)
  @JoinColumn({ name: 'membership_id' })
  membership: Membership;

  @Column()
  action: 'CREATED' | 'RENEWED' | 'CANCELLED' | 'UPGRADED' | 'DOWNGRADED';

  @Column({ type: 'json', nullable: true })
  changes: Record<string, any>;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
