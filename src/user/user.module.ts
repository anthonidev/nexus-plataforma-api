import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTreeController } from './controllers/user-tree.controller';
import { UserController } from './controllers/user.controller';
import { BankInfo } from './entities/bank-info.entity';
import { BillingInfo } from './entities/billing-info.entity';
import { ContactInfo } from './entities/contact-info.entity';
import { PersonalInfo } from './entities/personal-info.entity';
import { Role } from './entities/roles.entity';
import { Ubigeo } from './entities/ubigeo.entity';
import { User } from './entities/user.entity';
import { View } from './entities/view.entity';
import { UserTreeService } from './services/user-tree.service';
import { UserService } from './services/user.service';

@Module({
  controllers: [UserController, UserTreeController],
  providers: [UserService, UserTreeService],
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
