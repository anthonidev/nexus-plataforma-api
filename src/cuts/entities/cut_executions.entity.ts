import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CutConfiguration } from './cut_configurations.entity';
import { CutExecutionLog } from './cut_execution_logs.entity';

export enum CutExecutionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Entity('cut_executions')
@Index(['configuration'])
@Index(['status'])
@Index(['startDate', 'endDate'])
@Index(['executionDate'])
export class CutExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CutConfiguration, (config) => config.executions, {
    nullable: false,
  })
  @JoinColumn({ name: 'configuration_id' })
  @ValidateNested()
  @Type(() => CutConfiguration)
  @IsNotEmpty({ message: 'La configuración de corte es requerida' })
  configuration: CutConfiguration;

  @Column({
    type: 'enum',
    enum: CutExecutionStatus,
    default: CutExecutionStatus.PENDING,
  })
  @IsEnum(CutExecutionStatus, {
    message: 'El estado debe ser válido',
  })
  status: CutExecutionStatus;

  @Column({ type: 'date' })
  @IsDate({ message: 'La fecha de ejecución debe ser una fecha válida' })
  executionDate: Date;

  @Column({ type: 'date' })
  @IsDate({
    message: 'La fecha de inicio del período debe ser una fecha válida',
  })
  startDate: Date;

  @Column({ type: 'date' })
  @IsDate({ message: 'La fecha de fin del período debe ser una fecha válida' })
  endDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  @IsOptional()
  @IsDate()
  startedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  @IsOptional()
  @IsDate()
  finishedAt: Date;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  errorMessage: string;

  @Column({
    type: 'int',
    default: 0,
  })
  @IsNumber()
  @Min(0, {
    message: 'El número de registros procesados no puede ser negativo',
  })
  processedRecords: number;

  @Column({
    type: 'int',
    default: 0,
  })
  @IsNumber()
  @Min(0, { message: 'El número de registros exitosos no puede ser negativo' })
  successfulRecords: number;

  @Column({
    type: 'int',
    default: 0,
  })
  @IsNumber()
  @Min(0, { message: 'El número de registros fallidos no puede ser negativo' })
  failedRecords: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El total procesado no puede ser negativo' })
  totalProcessed: number;

  @OneToMany(() => CutExecutionLog, (log) => log.execution)
  logs: CutExecutionLog[];

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  parameters: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  results: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
