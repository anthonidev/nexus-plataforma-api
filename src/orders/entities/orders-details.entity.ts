import { IsNotEmpty, IsNumber, IsUUID, Min, ValidateNested } from "class-validator";
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Order } from "./orders.entity";
import { Type } from "class-transformer";
import { Product } from "src/ecommerce/entities/products.entity";

@Entity('orders_details')
@Index(['order'])
export class OrdersDetails {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;

  @ManyToOne(() => Order, { nullable: false })
  @JoinColumn({ name: 'order_id' })
  @ValidateNested()
  @Type(() => Order)
  @IsNotEmpty({ message: 'La orden es requerida' })
  order: Order;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  @ValidateNested()
  @Type(() => Product)
  @IsNotEmpty({ message: 'El producto es requerido' })
  product: Product;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) 
    }
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número válido con hasta 2 decimales' }
  )
  @Min(0, { message: 'El precio no puede ser negativo' })
  price: number;

  @Column({ type: 'integer' })
  @IsNumber()
  @Min(1, { message: 'La cantidad no puede ser negativa' })
  quantity: number;
  
  @CreateDateColumn()
  createdAt: Date;
  
  @UpdateDateColumn()
  updatedAt: Date;
}