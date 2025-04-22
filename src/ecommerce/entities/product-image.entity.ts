import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Product } from './products.entity';

@Entity('product_images')
export class ProductImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'La URL de la imagen es requerida' })
  url: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  cloudinaryPublicId: string;

  @Column({ default: false })
  @IsBoolean()
  isMain: boolean;

  @Column({ default: 0 })
  @IsNumber()
  @Min(0)
  order: number;

  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
