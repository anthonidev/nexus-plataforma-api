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

@Entity('user_ranks')
export class UserRank {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Rank)
  @JoinColumn({ name: 'current_rank_id' })
  currentRank: Rank;

  @ManyToOne(() => Rank)
  @JoinColumn({ name: 'highest_rank_id' })
  highestRank: Rank;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  monthlyPoints: number;

  @Column({ type: 'int', default: 0 })
  leftDirects: number;

  @Column({ type: 'int', default: 0 })
  rightDirects: number;

  @Column({ type: 'date' })
  periodDate: Date;

  @CreateDateColumn()
  createdAt: Date;
}
