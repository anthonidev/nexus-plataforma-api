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
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MembershipPlan } from './membership-plan.entity';
import { Membership } from './membership.entity';

export enum UpgradeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('membership_upgrades')
export class MembershipUpgrade {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Membership, (membership) => membership.upgrades, {
    nullable: false,
  })
  @JoinColumn({ name: 'membership_id' })
  @ValidateNested()
  @Type(() => Membership)
  @IsNotEmpty({ message: 'La membresía es requerida' })
  membership: Membership;

  @ManyToOne(() => MembershipPlan, { nullable: false })
  @JoinColumn({ name: 'from_plan_id' })
  @ValidateNested()
  @Type(() => MembershipPlan)
  @IsNotEmpty({ message: 'El plan original es requerido' })
  fromPlan: MembershipPlan;

  @ManyToOne(() => MembershipPlan, { nullable: false })
  @JoinColumn({ name: 'to_plan_id' })
  @ValidateNested()
  @Type(() => MembershipPlan)
  @IsNotEmpty({ message: 'El plan destino es requerido' })
  toPlan: MembershipPlan;

  @Column({ default: 'PENDING' })
  @IsEnum(UpgradeStatus, {
    message: 'El estado debe ser PENDING, COMPLETED o CANCELLED',
  })
  status: UpgradeStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El costo de actualización debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El costo de actualización no puede ser negativo' })
  upgradeCost: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  paymentReference: string;

  @Column({ type: 'json', nullable: true })
  @IsOptional()
  paymentDetails: Record<string, any>;

  @Column({ type: 'date', nullable: true })
  @IsOptional()
  @IsDate()
  completedDate: Date;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validateUpgrade() {
    // Verificar que se está actualizando a un plan de mayor valor
    if (
      this.fromPlan &&
      this.toPlan &&
      Number(this.fromPlan.price) >= Number(this.toPlan.price)
    ) {
      throw new Error(
        'El plan destino debe tener un precio mayor que el plan original',
      );
    }

    // Verificar que el costo de actualización sea la diferencia correcta
    if (this.fromPlan && this.toPlan && this.upgradeCost) {
      const expectedCost = this.toPlan.price - this.fromPlan.price;
      if (
        this.upgradeCost < 0 ||
        Math.abs(this.upgradeCost - expectedCost) > 0.01
      ) {
        throw new Error(
          'El costo de actualización debe ser la diferencia entre los precios de los planes',
        );
      }
    }
  }
}
