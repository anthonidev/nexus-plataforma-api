import { Body, Controller, Post, Param } from '@nestjs/common';
import { Public } from '../decorators/is-public.decorator';
import { RequestResetDto, ResetPasswordDto } from '../dto/request-reset.dto';
import { PasswordResetService } from '../services/password-reset.service';

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Public()
  @Post('request')
  async requestReset(@Body() requestResetDto: RequestResetDto) {
    return this.passwordResetService.requestPasswordReset(
      requestResetDto.email,
    );
  }

  @Public()
  @Post('verify/:token')
  async verifyToken(@Param('token') token: string) {
    return this.passwordResetService.verifyResetToken(token);
  }

  @Public()
  @Post('reset/:token')
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
