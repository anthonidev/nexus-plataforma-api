import {
  Body,
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CreateMembershipSubscriptionDto } from '../dto/create-membership-subscription.dto';
import { UserMembershipsService } from '../services/user-memberships.service';
import { ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('user-memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserMembershipsController {
  constructor(
    private readonly userMembershipsService: UserMembershipsService,
  ) { }
  @Post('subscribe')
  @UseInterceptors(FilesInterceptor('paymentImages', 5))
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Crear suscripción' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Suscripción creada con éxito' })
  createSubscription(
    @GetUser() user,
    @Body() createDto: CreateMembershipSubscriptionDto,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    files: Array<Express.Multer.File>,
  ) {
    return this.userMembershipsService.createSubscription(
      user.id,
      createDto,
      files,
    );
  }

  @Post('upgrade')
  @UseInterceptors(FilesInterceptor('paymentImages', 5))
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Actualizar suscripción' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Suscripción actualizada con éxito' })
  updateMembership(
    @GetUser() user,
    @Body() updateDto: CreateMembershipSubscriptionDto,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    files: Array<Express.Multer.File>,
  ) {
    return this.userMembershipsService.updateMembership(
      user.id,
      updateDto,
      files,
    );
  }
}
