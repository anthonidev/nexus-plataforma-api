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
} from 'class-validator';
import { Transform } from 'class-transformer';

@Entity('bank_info')
export class BankInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del banco es requerido' })
  @MaxLength(100, {
    message: 'El nombre del banco no puede tener más de 100 caracteres',
  })
  @Transform(({ value }) => value?.trim())
  bankName: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'El número de cuenta es requerido' })
  @MaxLength(30, {
    message: 'El número de cuenta no puede tener más de 30 caracteres',
  })
  @Matches(/^[0-9-]+$/, {
    message: 'El número de cuenta solo debe contener números y guiones',
  })
  @Transform(({ value }) => value?.trim())
  accountNumber: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El CCI no puede tener más de 30 caracteres' })
  @Matches(/^[0-9-]+$/, {
    message: 'El CCI solo debe contener números y guiones',
  })
  @Transform(({ value }) => value?.trim())
  cci: string;

  @OneToOne(() => User, (user) => user.bankInfo, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
