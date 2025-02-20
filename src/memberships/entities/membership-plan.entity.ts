import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Membership } from './membership.entity';

@Entity('membership_plans')
export class MembershipPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  checkAmount: number;

  @Column({ type: 'int' })
  binaryPoints: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  commissionPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  directCommissionAmount: number;

  @Column('text', { array: true })
  products: string[];

  @Column('text', { array: true })
  benefits: string[];

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Membership, (membership) => membership.plan)
  memberships: Membership[];
}
