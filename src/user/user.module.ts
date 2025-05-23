import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './controllers/profile.controller';
import { UserController } from './controllers/user.controller';
import { BankInfo } from './entities/bank-info.entity';
import { BillingInfo } from './entities/billing-info.entity';
import { ContactInfo } from './entities/contact-info.entity';
import { PersonalInfo } from './entities/personal-info.entity';
import { Role } from './entities/roles.entity';
import { Ubigeo } from './entities/ubigeo.entity';
import { User } from './entities/user.entity';
import { View } from './entities/view.entity';
import { ProfileService } from './services/profile.service';
import { UserTreeService } from './services/user-tree.service';
import { UserService } from './services/user.service';
import { UbigeoController } from './controllers/ubigeo.controller';
import { UbigeoService } from './services/ubigeo.service';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { UserTreeController } from './controllers/user-tree.controller';

import { RanksModule } from 'src/ranks/ranks.module';

@Module({
  controllers: [
    UserController,
    ProfileController,
    UserTreeController,
    UbigeoController,
  ],
  providers: [UserService, UserTreeService, ProfileService, UbigeoService],
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
    CloudinaryModule,
    forwardRef(() => MembershipsModule),
    forwardRef(() => RanksModule),
  ],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
