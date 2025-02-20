import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Rank } from './rank.entity';
import { User } from 'src/user/entities/user.entity';

@Entity('rank_history')
export class RankHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Rank)
  @JoinColumn({ name: 'rank_id' })
  rank: Rank;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  achievedPoints: number;

  @Column({ type: 'int' })
  leftDirects: number;

  @Column({ type: 'int' })
  rightDirects: number;

  @Column({ type: 'date' })
  periodDate: Date;

  @CreateDateColumn()
  createdAt: Date;
}
