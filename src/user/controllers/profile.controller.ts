import {
  Body,
  Controller,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UpdateBankInfoDto } from '../dto/update-back-info.dto';
import { UpdateBillingInfoDto } from '../dto/update-billing-info.dto';
import { UpdateContactInfoDto } from '../dto/update-contact-info.dto';
import { UpdatePersonalInfoDto } from '../dto/update-personal-info.dto';
import { User } from '../entities/user.entity';
import { ProfileService } from '../services/profile.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener perfil de usuario' })
  @ApiResponse({ status: 200, description: 'Perfil de usuario en' })
  getUserProfile(@GetUser() user: User) {
    return this.profileService.getUserProfile(user.id);
  }

  @Put('contact-info')
  @ApiOperation({ summary: 'Actualizar información de contacto' })
  @ApiResponse({ status: 200, description: 'Información de contacto actualizada' })
  updateContactInfo(
    @GetUser() user: User,
    @Body() updateContactInfoDto: UpdateContactInfoDto,
  ) {
    return this.profileService.updateContactInfo(user.id, updateContactInfoDto);
  }

  @Put('billing-info')
  @ApiOperation({ summary: 'Actualizar información de facturación' })
  @ApiResponse({ status: 200, description: 'Información de facturación actualizada' })
  updateBillingInfo(
    @GetUser() user: User,
    @Body() updateBillingInfoDto: UpdateBillingInfoDto,
  ) {
    return this.profileService.updateBillingInfo(user.id, updateBillingInfoDto);
  }

  @Put('bank-info')
  @ApiOperation({ summary: 'Actualizar información de banco' })
  @ApiResponse({ status: 200, description: 'Información de banco actualizada' })
  updateBankInfo(
    @GetUser() user: User,
    @Body() updateBankInfoDto: UpdateBankInfoDto,
  ) {
    return this.profileService.updateBankInfo(user.id, updateBankInfoDto);
  }

  @Put('personal-info')
  @ApiOperation({ summary: 'Actualizar información personal' })
  updatePersonalInfo(
    @GetUser() user: User,
    @Body() updatePersonalInfoDto: UpdatePersonalInfoDto,
  ) {
    return this.profileService.updatePersonalInfo(
      user.id,
      updatePersonalInfoDto,
    );
  }
  @Put('photo')
  @ApiOperation({ summary: 'Actualizar foto de perfil' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo de imagen (jpg, jpeg o png) de máximo 2MB',
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Foto de perfil actualizada' })
  @UseInterceptors(FileInterceptor('photo'))
  updatePhoto(
    @GetUser() user: User,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 2, // 2MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    photo: Express.Multer.File,
  ) {
    return this.profileService.updatePhoto(user.id, photo);
  }
}
