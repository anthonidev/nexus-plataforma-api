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

@Entity('contact_info')
export class ContactInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  postalCode: string;

  @ManyToOne(() => Ubigeo)
  @JoinColumn({ name: 'ubigeo_id' })
  ubigeo: Ubigeo;

  @OneToOne(() => User, (user) => user.contactInfo)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
