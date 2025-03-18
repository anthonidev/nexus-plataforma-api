import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { PersonalInfo } from './personal-info.entity';
import { ContactInfo } from './contact-info.entity';
import { BillingInfo } from './billing-info.entity';
import { BankInfo } from './bank-info.entity';
import { Role } from './roles.entity';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { Exclude, Transform } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;

  @Column({ unique: true })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @Column('text', {
    select: false,
    nullable: false,
  })
  @Exclude()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{6,}$/, {
    message:
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;

  @Column('text', { unique: true })
  referralCode: string;

  @Column('text', { nullable: true })
  referrerCode: string;

  @Column('bool', {
    default: true,
  })
  @IsBoolean()
  isActive: boolean;

  @CreateDateColumn()
  @IsDate()
  createdAt: Date;

  @UpdateDateColumn()
  @IsDate()
  updatedAt: Date;

  @Column('text', { nullable: true })
  @IsOptional()
  @IsDate()
  lastLoginAt: Date;

  @ManyToOne(() => Role, {
    nullable: false,
  })
  @IsNotEmpty({ message: 'El rol es requerido' })
  role: Role;

  @OneToOne(() => PersonalInfo, (personalInfo) => personalInfo.user)
  personalInfo: PersonalInfo;

  @OneToOne(() => ContactInfo, (contactInfo) => contactInfo.user)
  contactInfo: ContactInfo;

  @OneToOne(() => BillingInfo, (billingInfo) => billingInfo.user)
  billingInfo: BillingInfo;

  @OneToOne(() => BankInfo, (bankInfo) => bankInfo.user)
  bankInfo: BankInfo;

  @BeforeInsert()
  @BeforeUpdate()
  emailToLowerCase() {
    this.email = this.email?.toLowerCase().trim();
  }
}
