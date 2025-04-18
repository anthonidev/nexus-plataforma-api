import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { User } from 'src/user/entities/user.entity';
import { GetUser } from '../decorators/get-user.decorator';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ChangePasswordService } from '../services/change-password.service';

@Controller('auth/change-password')
@UseGuards(JwtAuthGuard)
export class ChangePasswordController {
  constructor(private readonly changePasswordService: ChangePasswordService) {}

  @Post()
  async changePassword(
    @GetUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.changePasswordService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }
}
