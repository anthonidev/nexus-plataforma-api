import { Type } from 'class-transformer';
import {
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
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './products.entity';

export enum StockActionType {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
  UPDATE = 'UPDATE',
}

@Entity('product_stock_history')
export class ProductStockHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.stockHistory, {
    nullable: false,
  })
  @JoinColumn({ name: 'product_id' })
  @ValidateNested()
  @Type(() => Product)
  @IsNotEmpty({ message: 'El producto es requerido' })
  product: Product;

  @Column({
    type: 'enum',
    enum: StockActionType,
  })
  @IsEnum(StockActionType, {
    message: 'El tipo de acción debe ser válido (INCREASE, DECREASE, UPDATE)',
  })
  actionType: StockActionType;

  @Column()
  @IsNumber()
  @Min(0, { message: 'La cantidad anterior no puede ser negativa' })
  previousQuantity: number;

  @Column()
  @IsNumber()
  @Min(0, { message: 'La cantidad nueva no puede ser negativa' })
  newQuantity: number;

  @Column()
  @IsNumber()
  @Min(0, { message: 'La cantidad modificada no puede ser negativa' })
  quantityChanged: number;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  notes: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by_id' })
  @IsOptional()
  @ValidateNested()
  @Type(() => User)
  updatedBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
