import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';

@Entity('company_transactions')
export class CompanyTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: 'INCOME' | 'WITHDRAWAL' | 'COMMISSION_PAYMENT' | 'BONUS_PAYMENT';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    sourceType?: string;
    sourceId?: number;
    description?: string;
    bankInfo?: {
      bankName?: string;
      accountNumber?: string;
      accountType?: string;
    };
    paymentEvidence?: {
      fileUrl?: string;
      uploadedAt?: Date;
    };
  };

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  companyBalanceAfter: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  processedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'processed_by_id' })
  processedBy: User;
}
