import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Ubigeo } from './ubigeo.entity';

@Entity('billing_info')
export class BillingInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  address: string;

  @ManyToOne(() => Ubigeo)
  @JoinColumn({ name: 'ubigeo_id' })
  ubigeo: Ubigeo;

  @OneToOne(() => User, (user) => user.billingInfo)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
