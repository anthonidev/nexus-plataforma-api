import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CutExecution } from './cut_executions.entity';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export enum ExecutionAction {
  EXECUTION_STARTED = 'EXECUTION_STARTED',
  EXECUTION_COMPLETED = 'EXECUTION_COMPLETED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  RECORD_PROCESSED = 'RECORD_PROCESSED',
  BATCH_PROCESSED = 'BATCH_PROCESSED',
  SYSTEM_EVENT = 'SYSTEM_EVENT',
  CUSTOM_EVENT = 'CUSTOM_EVENT',
}

@Entity('cut_execution_logs')
@Index(['execution'])
@Index(['level'])
@Index(['action'])
export class CutExecutionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CutExecution, (execution) => execution.logs, {
    nullable: false,
  })
  @JoinColumn({ name: 'execution_id' })
  @ValidateNested()
  @Type(() => CutExecution)
  @IsNotEmpty({ message: 'La ejecución de corte es requerida' })
  execution: CutExecution;

  @Column({ type: 'enum', enum: LogLevel, default: LogLevel.INFO })
  @IsEnum(LogLevel, {
    message: 'El nivel de log debe ser válido',
  })
  level: LogLevel;

  @Column({ type: 'enum', enum: ExecutionAction })
  @IsEnum(ExecutionAction, {
    message: 'La acción debe ser válida',
  })
  action: ExecutionAction;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El mensaje es requerido' })
  message: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  details: string;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  data: Record<string, any>;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  entityType: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  entityId: string;

  @CreateDateColumn()
  createdAt: Date;
}
