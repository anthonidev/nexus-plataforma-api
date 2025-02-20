import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('points_transactions')
export class PointsTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  type: 'BINARY_COMMISSION' | 'WITHDRAWAL' | 'DIRECT_BONUS';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    description?: string;
    withdrawalInfo?: {
      bankAccount?: string;
      bankName?: string;
    };
  };

  @CreateDateColumn()
  createdAt: Date;
}
