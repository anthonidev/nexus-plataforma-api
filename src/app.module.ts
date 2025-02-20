import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from './config/envs';
import { UserModule } from './user/user.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PaymentsModule } from './payments/payments.module';
import { BinaryModule } from './binary/binary.module';
import { RanksModule } from './ranks/ranks.module';
import { CompanyModule } from './company/company.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: envs.dbHost,
        port: envs.dbPort,
        database: envs.dbName,
        username: envs.dbUsername,
        password: envs.dbPassword,
        autoLoadEntities: true,
        // synchronize: envs.environment !== 'production',
        synchronize: true,
      }),
    }),
    UserModule,
    MembershipsModule,
    PaymentsModule,
    BinaryModule,
    RanksModule,
    CompanyModule,
  ],
})
export class AppModule {}
