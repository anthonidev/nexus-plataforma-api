import { CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PointsTransaction } from './points_transactions.entity';
import { Payment } from 'src/payments/entities/payment.entity';

@Entity('points_transactions_payments')
export class PointsTransactionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => PointsTransaction,
    (pointsTransaction) => pointsTransaction.pointsTransactionsPayments
  )
  @JoinColumn({ name: 'points_transaction_id' })
  pointsTransaction: PointsTransaction;

  @ManyToOne(
    () => Payment,
    (payment) => payment.pointsTransactionsPayments
  )
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  updatedAt: Date;
}