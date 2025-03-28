import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from './config/envs';
import { UserModule } from './user/user.module';

import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PaymentsModule } from './payments/payments.module';

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
    AuthModule,
    SeedModule,
    MembershipsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
