import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('bank_info')
export class BankInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  bankName: string;

  @Column()
  accountNumber: string;

  @Column({ nullable: true })
  cci: string;

  @OneToOne(() => User, (user) => user.bankInfo)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
