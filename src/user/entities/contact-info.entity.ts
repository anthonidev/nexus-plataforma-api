import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Ubigeo } from './ubigeo.entity';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

@Entity('contact_info')
export class ContactInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El número de teléfono es requerido' })
  @MaxLength(20, {
    message: 'El número de teléfono no puede tener más de 20 caracteres',
  })
  @Matches(/^[0-9+()-\s]+$/, {
    message:
      'El número de teléfono solo debe contener números, símbolos (+, -, ()) y espacios',
  })
  @Transform(({ value }) => value?.trim())
  phone: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: 'La dirección no puede tener más de 200 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  address: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10, {
    message: 'El código postal no puede tener más de 10 caracteres',
  })
  @Matches(/^[a-zA-Z0-9-\s]+$/, {
    message:
      'El código postal solo debe contener letras, números, guiones y espacios',
  })
  @Transform(({ value }) => value?.trim())
  postalCode: string;

  @ManyToOne(() => Ubigeo)
  @JoinColumn({ name: 'ubigeo_id' })
  @IsOptional()
  @ValidateNested()
  @Type(() => Ubigeo)
  ubigeo: Ubigeo;

  @OneToOne(() => User, (user) => user.contactInfo)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
