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
import { User } from 'src/user/entities/user.entity';
import { PaymentConfig } from './payment-config.entity';
import { PaymentImage } from './payment-image.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => PaymentConfig)
  @JoinColumn({ name: 'payment_config_id' })
  paymentConfig: PaymentConfig;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column()
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ nullable: true })
  rejectionReason: string;

  @OneToMany(() => PaymentImage, (image) => image.payment)
  images: PaymentImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: User;

  @Column({ nullable: true })
  reviewedAt: Date;

  @Column({ default: false })
  isArchived: boolean;
}
