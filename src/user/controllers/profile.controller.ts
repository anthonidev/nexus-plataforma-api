import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UpdateBankInfoDto } from '../dto/update-back-info.dto';
import { UpdateBillingInfoDto } from '../dto/update-billing-info.dto';
import { UpdateContactInfoDto } from '../dto/update-contact-info.dto';
import { UpdatePersonalInfoDto } from '../dto/update-personal-info.dto';
import { User } from '../entities/user.entity';
import { ProfileService } from '../services/profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getUserProfile(@GetUser() user: User) {
    return this.profileService.getUserProfile(user.id);
  }

  @Put('contact-info')
  updateContactInfo(
    @GetUser() user: User,
    @Body() updateContactInfoDto: UpdateContactInfoDto,
  ) {
    return this.profileService.updateContactInfo(user.id, updateContactInfoDto);
  }

  @Put('billing-info')
  updateBillingInfo(
    @GetUser() user: User,
    @Body() updateBillingInfoDto: UpdateBillingInfoDto,
  ) {
    return this.profileService.updateBillingInfo(user.id, updateBillingInfoDto);
  }

  @Put('bank-info')
  updateBankInfo(
    @GetUser() user: User,
    @Body() updateBankInfoDto: UpdateBankInfoDto,
  ) {
    return this.profileService.updateBankInfo(user.id, updateBankInfoDto);
  }

  @Put('personal-info')
  updatePersonalInfo(
    @GetUser() user: User,
    @Body() updatePersonalInfoDto: UpdatePersonalInfoDto,
  ) {
    return this.profileService.updatePersonalInfo(
      user.id,
      updatePersonalInfoDto,
    );
  }
}
