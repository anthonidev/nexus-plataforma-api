import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CutExecution } from './cut_executions.entity';

export enum CutFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  ON_DEMAND = 'ON_DEMAND',
}

@Entity('cut_configurations')
@Index(['code'], { unique: true })
@Index(['isActive'])
export class CutConfiguration {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @IsString()
  @IsNotEmpty({ message: 'El código es requerido' })
  @Transform(({ value }) => value?.toUpperCase().trim())
  code: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  description: string;

  @Column({ type: 'enum', enum: CutFrequency })
  @IsEnum(CutFrequency, { message: 'La frecuencia debe ser válida' })
  frequency: CutFrequency;

  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  cronExpression: string;

  @Column({ default: 0 })
  @IsInt()
  @Min(0, { message: 'El día del mes debe ser un número positivo' })
  dayOfMonth: number;

  @Column({ default: 0 })
  @IsInt()
  @Min(0, { message: 'El día de la semana debe ser un número positivo' })
  dayOfWeek: number;

  @Column({ default: 0 })
  @IsInt()
  @Min(0, { message: 'La hora debe ser un número positivo' })
  hour: number;

  @Column({ default: 0 })
  @IsInt()
  @Min(0, { message: 'Los minutos deben ser un número positivo' })
  minute: number;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  parameters: Record<string, any>;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  serviceClassName: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  methodName: string;

  @OneToMany(() => CutExecution, (execution) => execution.configuration)
  executions: CutExecution[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
