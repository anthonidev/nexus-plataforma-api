import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PersonalInfo } from './personal-info.entity';
import { ContactInfo } from './contact-info.entity';
import { BillingInfo } from './billing-info.entity';
import { BankInfo } from './bank-info.entity';
import { Role } from './roles.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ unique: true })
  referralCode: string;

  @Column({ nullable: true })
  referrerCode: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ nullable: true })
  roleId: number;

  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'left_child_id' })
  leftChild: User;

  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'right_child_id' })
  rightChild: User;

  @Column({ nullable: true })
  leftChildId: number;

  @Column({ nullable: true })
  rightChildId: number;

  @Column({ nullable: true })
  position: 'LEFT' | 'RIGHT';

  @Column({ default: 0 })
  level: number;

  @OneToOne(() => PersonalInfo, (personalInfo) => personalInfo.user)
  personalInfo: PersonalInfo;

  @OneToOne(() => ContactInfo, (contactInfo) => contactInfo.user)
  contactInfo: ContactInfo;

  @OneToOne(() => BillingInfo, (billingInfo) => billingInfo.user)
  billingInfo: BillingInfo;

  @OneToOne(() => BankInfo, (bankInfo) => bankInfo.user)
  bankInfo: BankInfo;
}
