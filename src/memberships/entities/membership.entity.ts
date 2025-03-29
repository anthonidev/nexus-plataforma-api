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
import { User } from 'src/user/entities/user.entity';
import {
  BeforeInsert,
  BeforeUpdate,
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
import { MembershipPlan } from './membership-plan.entity';
import { MembershipReconsumption } from './membership-recosumption.entity';
import { MembershipUpgrade } from './membership_upgrades.entity';

export enum MembershipStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
}

@Entity('memberships')
@Index(['user', 'status'], { where: "status = 'ACTIVE'" }) // Para consultas rápidas de membresías activas por usuario
export class Membership {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  @ValidateNested()
  @Type(() => User)
  @IsNotEmpty({ message: 'El usuario es requerido' })
  user: User;

  @ManyToOne(() => MembershipPlan, { nullable: false })
  @JoinColumn({ name: 'plan_id' })
  @ValidateNested()
  @Type(() => MembershipPlan)
  @IsNotEmpty({ message: 'El plan es requerido' })
  plan: MembershipPlan;

  @Column({ type: 'date' })
  @IsDate({ message: 'La fecha de inicio debe ser una fecha válida' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  @IsOptional()
  @IsDate({ message: 'La fecha de fin debe ser una fecha válida' })
  endDate: Date;

  @Column({ default: 'PENDING' })
  @IsEnum(MembershipStatus, {
    message: 'El estado debe ser PENDING, ACTIVE, INACTIVE o EXPIRED',
  })
  status: MembershipStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto pagado debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto pagado no puede ser negativo' })
  paidAmount: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  paymentReference: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 300 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto mínimo de reconsumo debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto mínimo de reconsumo no puede ser negativo' })
  minimumReconsumptionAmount: number;

  @Column({ type: 'date' })
  @IsDate({
    message: 'La fecha del próximo reconsumo debe ser una fecha válida',
  })
  nextReconsumptionDate: Date;

  @Column({ type: 'int', default: 0 })
  @IsNumber()
  @Min(0, { message: 'Los puntos binarios acumulados no pueden ser negativos' })
  accumulatedBinaryPoints: number;

  @Column({ type: 'boolean', default: false })
  autoRenewal: boolean;

  @OneToMany(
    () => MembershipReconsumption,
    (reconsumption) => reconsumption.membership,
    { cascade: true },
  )
  reconsumptions: MembershipReconsumption[];

  @OneToMany(() => MembershipUpgrade, (upgrade) => upgrade.membership, {
    cascade: true,
  })
  upgrades: MembershipUpgrade[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validateDates() {
    // Asegurar que la fecha de fin no sea anterior a la fecha de inicio
    if (this.startDate && this.endDate && this.endDate < this.startDate) {
      throw new Error(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
    }

    // Asegurar que la fecha de próximo reconsumo no sea anterior a la fecha actual
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (this.nextReconsumptionDate && this.nextReconsumptionDate < today) {
      throw new Error(
        'La fecha del próximo reconsumo no puede ser anterior a la fecha actual',
      );
    }
  }
}
