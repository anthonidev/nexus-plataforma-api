import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './roles.entity';
class StyleMetadata {
  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;
  @IsOptional()
  @IsHexColor()
  textColor?: string;
}
class Metadata {
  @IsOptional()
  @ValidateNested()
  @Type(() => StyleMetadata)
  style?: StyleMetadata;
}
@Entity('views')
export class View {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ unique: true })
  @IsString()
  @IsNotEmpty({ message: 'El código es requerido' })
  @MinLength(2, { message: 'El código debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El código no puede tener más de 50 caracteres' })
  @Transform(({ value }) => value?.toUpperCase().trim())
  code: string;
  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  name: string;
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'El icono no puede tener más de 50 caracteres' })
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'El icono solo debe contener letras, números y guiones',
  })
  icon: string;
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La URL no puede tener más de 200 caracteres' })
  url: string;
  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;
  @Column({ default: 0 })
  @IsNumber()
  @Min(0)
  order: number;
  @Column({ type: 'json', nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => Metadata)
  metadata: Metadata;
  @ManyToOne(() => View, (view) => view.children, { nullable: true })
  @IsOptional()
  @ValidateNested()
  parent: View;
  @OneToMany(() => View, (view) => view.parent, { nullable: true })
  @IsOptional()
  children: View[];
  @ManyToMany(() => Role)
  @JoinTable({
    name: 'role_views',
    joinColumn: {
      name: 'view_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
  })
  roles: Role[];
  @CreateDateColumn()
  createdAt: Date;
  @UpdateDateColumn()
  updatedAt: Date;
  @BeforeInsert()
  @BeforeUpdate()
  transformFields() {
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }
    if (this.name) {
      this.name = this.name.trim();
    }
  }
  isParentView(): boolean {
    return !this.parent && this.children?.length > 0;
  }
  isChildView(): boolean {
    return !!this.parent;
  }
  hasRole(roleCode: string): boolean {
    return this.roles?.some((role) => role.code === roleCode) ?? false;
  }
}
