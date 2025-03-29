import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

export enum MembershipAction {
  CREATED = 'CREATED',
  RENEWED = 'RENEWED',
  CANCELLED = 'CANCELLED',
  UPGRADED = 'UPGRADED',
  DOWNGRADED = 'DOWNGRADED',
  REACTIVATED = 'REACTIVATED',
  EXPIRED = 'EXPIRED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
}

@Entity('membership_history')
@Index(['membership'])
export class MembershipHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Membership, { nullable: false })
  @JoinColumn({ name: 'membership_id' })
  @ValidateNested()
  @Type(() => Membership)
  @IsNotEmpty({ message: 'La membresía es requerida' })
  membership: Membership;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by_id' })
  @IsOptional()
  @ValidateNested()
  @Type(() => User)
  performedBy: User;

  @Column()
  @IsEnum(MembershipAction, {
    message: 'La acción debe ser válida (CREATED, RENEWED, CANCELLED, etc.)',
  })
  action: MembershipAction;

  @Column({ type: 'json', nullable: true })
  @IsOptional()
  changes: Record<string, any>;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  notes: string;

  @Column({ type: 'json', nullable: true })
  @IsOptional()
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
