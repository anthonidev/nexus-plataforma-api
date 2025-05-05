import { Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Order } from "./orders.entity";
import { User } from "src/user/entities/user.entity";
import { OrderAction } from "../enums/orders-action.enum";

@Entity('orders_history')
@Index(['order'])
export class OrderHistory {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;
  
  @ManyToOne(() => Order, { nullable: false })
  @JoinColumn({ name: 'order_id' })
  @ValidateNested()
  @Type(() => Order)
  @IsNotEmpty({ message: 'La orden es requerida' })
  order: Order;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by_id' })
  @IsOptional()
  @ValidateNested()
  @Type(() => User)
  performedBy: User;

  @Column()
  @IsEnum(OrderAction, {
    message: 'La acción debe ser válida (CREATED, APPROVED, SENT, DELIVERED, REJECTED, CANCELLED)'
  })
  action: OrderAction;

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