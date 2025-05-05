import { Body, Controller, Post, Param } from '@nestjs/common';
import { Public } from '../decorators/is-public.decorator';
import { RequestResetDto, ResetPasswordDto } from '../dto/request-reset.dto';
import { PasswordResetService } from '../services/password-reset.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Public()
  @Post('request')
  @ApiOperation({ summary: 'Solicitar restablecimiento de contraseña' })
  @ApiResponse({ status: 200, description: 'Restablecimiento de contraseña solicitado' })
  async requestReset(@Body() requestResetDto: RequestResetDto) {
    return this.passwordResetService.requestPasswordReset(
      requestResetDto.email,
    );
  }

  @Public()
  @Post('verify/:token')
  @ApiOperation({ summary: 'Verificar token de restablecimiento de contraseña' })
  @ApiParam({ name: 'token', type: String, required: true })
  @ApiResponse({ status: 200, description: 'Token de restablecimiento de contraseña verificado' })
  async verifyToken(@Param('token') token: string) {
    return this.passwordResetService.verifyResetToken(token);
  }

  @Public()
  @Post('reset/:token')
  @ApiOperation({ summary: 'Restablecer contraseña' })
  @ApiParam({ name: 'token', type: String, required: true })
  @ApiResponse({ status: 200, description: 'Contraseña restablecida' })
  async resetPassword(
    @Param('token') token: string,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    return this.passwordResetService.resetPassword(
      token,
      resetPasswordDto.password,
    );
  }
}
