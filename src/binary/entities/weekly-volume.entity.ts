import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';

@Entity('weekly_volumes')
export class WeeklyVolume {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  leftVolume: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  rightVolume: number;

  @Column({ type: 'date' })
  weekStartDate: Date;

  @Column({ type: 'date' })
  weekEndDate: Date;

  @Column({ default: false })
  isProcessed: boolean;

  // Campos para cuando se procesa el volumen semanal
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  paidAmount: number;

  @Column({ nullable: true })
  paidSide: 'LEFT' | 'RIGHT';

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  carryOverVolume: number;

  @CreateDateColumn()
  createdAt: Date;
}
