import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { envs } from 'src/config/envs';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UserModule } from 'src/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { PasswordResetController } from './controllers/password-reset.controller';
import { MailModule } from 'src/mail/mail.module';
import { PasswordResetService } from './services/password-reset.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { ChangePasswordController } from './controllers/change-password.controller';
import { ChangePasswordService } from './services/change-password.service';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: envs.jwtSecret,
      signOptions: { expiresIn: '1h' },
    }),
    UserModule,
    TypeOrmModule.forFeature([PasswordResetToken]),
    MembershipsModule,
    MailModule,
    NotificationsModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    PasswordResetService,
    ChangePasswordService,
  ],
  controllers: [
    AuthController,
    PasswordResetController,
    ChangePasswordController,
  ],
  exports: [AuthService, TypeOrmModule],
})
export class AuthModule { }