import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Payment } from './payment.entity';

@Entity('payment_images')
export class PaymentImage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Payment, (payment) => payment.images)
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column()
  url: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  bankName: string;

  @Column()
  transactionReference: string;

  @Column({ type: 'timestamp' })
  transactionDate: Date;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
