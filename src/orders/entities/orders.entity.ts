import { Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, Min, ValidateNested } from "class-validator";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { OrderStatus } from "../enums/orders-status.enum";
import { OrdersDetails } from "./orders-details.entity";
import { OrderHistory } from "./orders-history.entity";

@Entity('orders')
@Index(['user'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  @ValidateNested()
  @Type(() => User)
  @IsNotEmpty({ message: 'El usuario es requerido' })
  user: User;

  @OneToMany(() => OrdersDetails, (item) => item.order, {
    cascade: true,
  })
  orderDetails: OrdersDetails[];

  @OneToMany(() => OrderHistory, (history) => history.order, {
    cascade: true,
  })
  orderHistory: OrderHistory[];

  @Column({ type: 'integer' })
  @IsNumber()
  @Min(1, { message: 'La cantidad de productos no puede ser menor a 1' })
  @IsNotEmpty({ message: 'El número de pedido es requerido' })
  totalItems: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 217,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto total debe ser un número válido con hasta 2 decimales' },
  )
  @Min(0, { message: 'El monto mínimo de la orden tiene que ser mayor a 0' })
  @IsNotEmpty({ message: 'El número de pedido es requerido' })
  totalAmount: number;

  @Column({ default: 'PENDING' })
  @IsEnum(OrderStatus,
    { message: 'El estado debe ser PENDING, APPROVED, SENT, DELIVERED o REJECTED' }
  )
  status: OrderStatus;

  @Column({ type: 'json', nullable: true })
  @IsOptional()
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}