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

@Controller('user-memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserMembershipsController {
  constructor(
    private readonly userMembershipsService: UserMembershipsService,
  ) {}
  @Post('subscribe')
  @UseInterceptors(FilesInterceptor('paymentImages', 5)) // Máximo 5 imágenes
  @UsePipes(new ValidationPipe({ transform: true }))
  createSubscription(
    @GetUser() user,
    @Body() createDto: CreateMembershipSubscriptionDto,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    files: Array<Express.Multer.File>,
  ) {
    // El controlador solo pasa los datos al servicio
    return this.userMembershipsService.createSubscription(
      user.id,
      createDto,
      files,
    );
  }
}
