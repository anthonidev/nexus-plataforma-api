import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRank } from './user_ranks.entity';

@Entity('ranks')
export class Rank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del rango es requerido' })
  @MaxLength(100, {
    message: 'El nombre del rango no puede exceder 100 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  name: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El código del rango es requerido' })
  @MaxLength(50, {
    message: 'El código del rango no puede exceder 50 caracteres',
  })
  @Transform(({ value }) => value?.toUpperCase().trim())
  code: string;

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
        'Los puntos requeridos deben ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'Los puntos requeridos no pueden ser negativos' })
  requiredPoints: number;

  @Column()
  @IsNumber(
    {},
    { message: 'Los directos requeridos deben ser un número entero' },
  )
  @Min(0, { message: 'Los directos requeridos no pueden ser negativos' })
  requiredDirects: number;

  @Column({
    default: true,
  })
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
  isActive: boolean;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  @IsOptional()
  benefits?: Record<string, any>;

  @OneToMany(() => UserRank, (userRank) => userRank.currentRank)
  currentUserRanks: UserRank[];

  @OneToMany(() => UserRank, (userRank) => userRank.highestRank)
  highestUserRanks: UserRank[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
