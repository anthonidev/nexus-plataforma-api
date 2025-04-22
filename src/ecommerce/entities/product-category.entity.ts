import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './products.entity';

@Entity('product_categories')
export class ProductCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la categoría es requerido' })
  @MaxLength(100, {
    message: 'El nombre de la categoría no puede tener más de 100 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  name: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(500, {
    message: 'La descripción no puede tener más de 500 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  description: string;

  @Column({ unique: true })
  @IsString()
  @IsNotEmpty({ message: 'El código es requerido' })
  @MaxLength(50, { message: 'El código no puede tener más de 50 caracteres' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  code: string;

  @Column({ default: 0 })
  order: number;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  transformCode() {
    if (this.code) {
      this.code = this.code.trim().toUpperCase();
    }
  }
}
