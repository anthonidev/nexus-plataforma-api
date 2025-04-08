import { Exclude, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BankInfo } from './bank-info.entity';
import { BillingInfo } from './billing-info.entity';
import { ContactInfo } from './contact-info.entity';
import { PersonalInfo } from './personal-info.entity';
import { Role } from './roles.entity';

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

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: User;

  // Referencias directas a hijos izquierdo y derecho (solo uno en cada posición)
  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'left_child_id' })
  leftChild: User;

  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'right_child_id' })
  rightChild: User;

  // Posición en el árbol binario (izquierda o derecha)
  @Column({ type: 'text', nullable: true })
  position: 'LEFT' | 'RIGHT';

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

  @OneToOne(() => BillingInfo, (billingInfo) => billingInfo.user, {
    nullable: true,
  })
  billingInfo: BillingInfo;

  @OneToOne(() => BankInfo, (bankInfo) => bankInfo.user, { nullable: true })
  bankInfo: BankInfo;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  nickname: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  photo: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  cloudinaryPublicId: string;

  @BeforeInsert()
  @BeforeUpdate()
  emailToLowerCase() {
    this.email = this.email?.toLowerCase().trim();
  }
}
