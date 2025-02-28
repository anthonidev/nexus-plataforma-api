import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Ubigeo } from './entities/ubigeo.entity';
import { Role } from './entities/roles.entity';
import { PersonalInfo } from './entities/personal-info.entity';
import { ContactInfo } from './entities/contact-info.entity';
import { BillingInfo } from './entities/billing-info.entity';
import { BankInfo } from './entities/bank-info.entity';
import { View } from './entities/view.entity';

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [
    TypeOrmModule.forFeature([
      User,
      View,
      Ubigeo,
      Role,
      PersonalInfo,
      ContactInfo,
      BillingInfo,
      BankInfo,
    ]),
  ],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
