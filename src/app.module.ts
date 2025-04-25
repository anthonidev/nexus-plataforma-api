import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from './config/envs';
import { UserModule } from './user/user.module';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CutsModule } from './cuts/cuts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EcommerceModule } from './ecommerce/ecommerce.module';
import { MailModule } from './mail/mail.module';
import { MembershipsModule } from './memberships/memberships.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PointsModule } from './points/points.module';
import { RanksModule } from './ranks/ranks.module';
import { SeedModule } from './seed/seed.module';
import { SystemModule } from './system/system.module';
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
    CutsModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DashboardModule,
    SystemModule,
    MailModule,
    EcommerceModule,
    NotificationsModule,
  ],
})
export class AppModule {}
