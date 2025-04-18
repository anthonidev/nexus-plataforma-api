// src/auth/services/password-reset.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { User } from 'src/user/entities/user.entity';
import { MailService } from 'src/mail/mail.service';
import { envs } from 'src/config/envs';
import { PasswordResetToken } from '../entities/password-reset-token.entity';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly SALT_ROUNDS = 10;
  private readonly TOKEN_EXPIRY_HOURS = 24; // Token valid for 24 hours

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepository: Repository<PasswordResetToken>,
    private readonly mailService: MailService,
  ) {}

  async requestPasswordReset(email: string) {
    try {
      // Find user
      const user = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
      });

      // Even if user doesn't exist, return success to prevent email enumeration attacks
      if (!user) {
        this.logger.warn(
          `Password reset requested for non-existent email: ${email}`,
        );
        return {
          success: true,
          message:
            'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña',
        };
      }

      // Create token
      const token = uuidv4();

      // Calculate expiry date (current time + configured hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

      // Save token
      const resetToken = this.resetTokenRepository.create({
        token,
        user,
        expiresAt,
      });
      await this.resetTokenRepository.save(resetToken);

      // Send email with reset link
      await this.sendPasswordResetEmail(user.email, token);

      return {
        success: true,
        message:
          'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña',
      };
    } catch (error) {
      this.logger.error(`Error in password reset request: ${error.message}`);
      throw new BadRequestException(
        'No se pudo procesar la solicitud de restablecimiento de contraseña',
      );
    }
  }

  async verifyResetToken(token: string) {
    try {
      const resetToken = await this.getValidToken(token);

      // If we get here, token is valid
      return {
        success: true,
        message: 'Token válido',
        email: resetToken.user.email,
      };
    } catch (error) {
      this.logger.error(`Token verification failed: ${error.message}`);
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const resetToken = await this.getValidToken(token);

      // Hash the new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update user's password
      await this.userRepository.update(
        { id: resetToken.user.id },
        { password: hashedPassword },
      );

      // Mark token as used
      resetToken.isUsed = true;
      await this.resetTokenRepository.save(resetToken);

      // Send confirmation email
      await this.sendPasswordChangeConfirmationEmail(resetToken.user.email);

      return {
        success: true,
        message: 'Contraseña actualizada correctamente',
      };
    } catch (error) {
      this.logger.error(`Password reset failed: ${error.message}`);
      throw error;
    }
  }

  private async getValidToken(token: string): Promise<PasswordResetToken> {
    const resetToken = await this.resetTokenRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new NotFoundException(
        'Token de restablecimiento no encontrado o inválido',
      );
    }

    if (resetToken.isUsed) {
      throw new UnauthorizedException('Este token ya ha sido utilizado');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new UnauthorizedException('El token ha expirado');
    }

    return resetToken;
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  private async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${envs.frontendUrl}/auth/reset-password/${token}`;

    await this.mailService.sendMail({
      to: email,
      subject: 'Restablecimiento de contraseña - Nexus Platform',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="color: #0066cc;">Restablecimiento de Contraseña</h1>
          <p>Has solicitado restablecer tu contraseña en Nexus Platform.</p>
          <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <a href="${resetUrl}" style="background-color: #0066cc; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0;">
            Restablecer mi contraseña
          </a>
          <p>Este enlace expirará en ${this.TOKEN_EXPIRY_HOURS} horas.</p>
          <p>Si no solicitaste este restablecimiento, puedes ignorar este correo.</p>
          <p>Saludos,<br>El equipo de Nexus Platform</p>
        </div>
      `,
    });
  }

  private async sendPasswordChangeConfirmationEmail(email: string) {
    await this.mailService.sendMail({
      to: email,
      subject: 'Confirmación de cambio de contraseña - Nexus Platform',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="color: #0066cc;">Cambio de Contraseña Exitoso</h1>
          <p>Tu contraseña ha sido actualizada correctamente.</p>
          <p>Si no realizaste este cambio, por favor contacta inmediatamente con nuestro equipo de soporte.</p>
          <p>Saludos,<br>El equipo de Nexus Platform</p>
        </div>
      `,
    });
  }
}
