import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';

export enum NotificationType {
  VOLUME_ADDED = 'VOLUME_ADDED',
  COMMISSION_EARNED = 'COMMISSION_EARNED',
  RANK_ACHIEVED = 'RANK_ACHIEVED',
  REFERRAL_REGISTERED = 'REFERRAL_REGISTERED',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  MEMBERSHIP_EXPIRING = 'MEMBERSHIP_EXPIRING',
  POINTS_MOVEMENT = 'POINTS_MOVEMENT',
  RECONSUMPTION_REMINDER = 'RECONSUMPTION_REMINDER',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
  DIRECT_BONUS = 'DIRECT_BONUS',
  MEMBERSHIP_UPGRADE = 'MEMBERSHIP_UPGRADE',
}

@Entity('notifications')
@Index(['user', 'isRead'])
@Index(['createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  actionUrl: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true, type: 'timestamp' })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
