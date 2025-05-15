export class Ecommerce { }
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { ProductImage } from './product-image.entity';
import { ProductStockHistory } from './product-stock-history.entity';

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del producto es requerido' })
  @MaxLength(200, {
    message: 'El nombre del producto no puede tener más de 200 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  name: string;

  @Column('text')
  @IsString()
  @IsNotEmpty({ message: 'La descripción del producto es requerida' })
  @Transform(({ value }) => value?.trim())
  description: string;

  @Column('text')
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  composition?: string;

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
        'El precio de socio debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El precio de socio no puede ser negativo' })
  memberPrice: number;

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
        'El precio público debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El precio público no puede ser negativo' })
  publicPrice: number;

  @Column('int')
  @IsNumber({}, { message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  stock: number;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  @Column({
    type: 'text',
    array: true,
    default: [],
  })
  @IsArray({ message: 'Los beneficios deben ser una lista' })
  @IsOptional()
  benefits: string[];

  @Column({ unique: true })
  @IsString()
  @IsNotEmpty({ message: 'El SKU es requerido' })
  @MaxLength(50, { message: 'El SKU no puede tener más de 50 caracteres' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  sku: string;

  @ManyToOne(() => ProductCategory, (category) => category.products)
  category: ProductCategory;

  @OneToMany(() => ProductImage, (image) => image.product, {
    cascade: true,
    eager: true,
  })
  images: ProductImage[];

  @OneToMany(() => ProductStockHistory, (history) => history.product)
  stockHistory: ProductStockHistory[];

  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  checkStock() {
    if (this.stock === 0 && this.status === ProductStatus.ACTIVE) {
      this.status = ProductStatus.OUT_OF_STOCK;
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  transformSku() {
    if (this.sku) {
      this.sku = this.sku.trim().toUpperCase();
    }
  }
}
