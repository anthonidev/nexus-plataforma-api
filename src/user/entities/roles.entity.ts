import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import {
  IsString,
  IsBoolean,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { User } from './user.entity';
import { View } from './view.entity';
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ unique: true })
  @IsString()
  @IsNotEmpty({ message: 'El código es requerido' })
  @MinLength(2, { message: 'El código debe tener al menos 2 caracteres' })
  @MaxLength(20, { message: 'El código no puede tener más de 20 caracteres' })
  @Transform(({ value }) => value?.toUpperCase().trim())
  code: string;
  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El nombre no puede tener más de 50 caracteres' })
  @Matches(/^[a-zA-ZÀ-ÿ\s]+$/, {
    message: 'El nombre solo debe contener letras y espacios',
  })
  @Transform(({ value }) => value?.trim())
  name: string;
  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;
  @CreateDateColumn()
  createdAt: Date;
  @UpdateDateColumn()
  updatedAt: Date;
  @OneToMany(() => User, (user) => user.role)
  @IsArray()
  @IsOptional()
  users: User[];
  @ManyToMany(() => View)
  @JoinTable({
    name: 'role_views',
    joinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'view_id',
      referencedColumnName: 'id',
    },
  })
  @IsArray()
  @IsOptional()
  views: View[];
  @BeforeInsert()
  @BeforeUpdate()
  transformCode() {
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }
  }
  hasView(viewCode: string): boolean {
    return this.views?.some((view) => view.code === viewCode) ?? false;
  }
  hasAnyView(viewCodes: string[]): boolean {
    return this.views?.some((view) => viewCodes.includes(view.code)) ?? false;
  }
  hasAllViews(viewCodes: string[]): boolean {
    return viewCodes.every((code) => this.hasView(code));
  }
}
