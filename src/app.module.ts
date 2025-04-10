import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from './config/envs';
import { UserModule } from './user/user.module';

import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PaymentsModule } from './payments/payments.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { PointsModule } from './points/points.module';
import { RanksModule } from './ranks/ranks.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';

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
        timezone: 'America/Lima',
      }),
    }),
    UserModule,
    AuthModule,
    CloudinaryModule,
    SeedModule,
    MembershipsModule,
    PaymentsModule,
    PointsModule,
    RanksModule,
    WithdrawalsModule,
  ],
})
export class AppModule {}
