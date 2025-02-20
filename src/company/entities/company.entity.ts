import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';

@Entity('company')
@Check(`id = 1`) // Asegura que solo exista un registro con ID 1
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  availableBalance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalIncome: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalWithdrawals: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCommissionsPaid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pendingPayments: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
