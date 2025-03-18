import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
  IsDate,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';

enum Gender {
  MASCULINO = 'MASCULINO',
  FEMENINO = 'FEMENINO',
  OTRO = 'OTRO',
}

@Entity('personal_info')
export class PersonalInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El apellido es requerido' })
  @MaxLength(100, {
    message: 'El apellido no puede tener más de 100 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20, {
    message: 'El número de documento no puede tener más de 20 caracteres',
  })
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message:
      'El número de documento solo debe contener letras, números y guiones',
  })
  documentNumber: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsEnum(Gender, { message: 'El género debe ser MASCULINO, FEMENINO o OTRO' })
  gender: string;

  @Column({ type: 'date', nullable: true })
  @IsOptional()
  @IsDate({ message: 'La fecha de nacimiento debe ser una fecha válida' })
  birthDate: Date;

  @OneToOne(() => User, (user) => user.personalInfo)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
