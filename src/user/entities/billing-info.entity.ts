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
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

@Entity('billing_info')
export class BillingInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'La dirección de facturación es requerida' })
  @MaxLength(200, {
    message: 'La dirección de facturación no puede tener más de 200 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  address: string;

  @ManyToOne(() => Ubigeo)
  @JoinColumn({ name: 'ubigeo_id' })
  @ValidateNested()
  @Type(() => Ubigeo)
  ubigeo: Ubigeo;

  @OneToOne(() => User, (user) => user.billingInfo)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
