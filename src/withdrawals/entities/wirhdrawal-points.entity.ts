import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Withdrawal } from "./withdrawal.entity";
import { PointsTransaction } from "src/points/entities/points_transactions.entity";
import { IsNumber, Min } from "class-validator";

@Entity("withdrawal_points")
export class WithdrawalPoints {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => Withdrawal,
    (withdrawal) => withdrawal.withdrawalPoints
  )
  @JoinColumn({ name: 'withdrawal_id' })
  withdrawal: Withdrawal;

  @ManyToOne(
    () => PointsTransaction,
    (points) => points.withdrawalPoints
  )
  @JoinColumn({ name: 'points_transaction_id' })
  points: PointsTransaction;

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
        'El monto usado para el retiro debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El monto usado para el retiro no puede ser negativo' })
  amountUsed: number;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  updatedAt: Date;
}