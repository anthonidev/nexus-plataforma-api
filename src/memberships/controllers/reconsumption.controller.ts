import {
  Body,
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Patch,
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
import {
  CreateReconsumptionDto,
  UpdateAutoRenewalDto,
} from '../dto/create-reconsumption.dto';
import { ReconsumptionService } from '../services/reconsumption.service';

@Controller('user-memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReconsumptionController {
  constructor(private readonly reconsumptionService: ReconsumptionService) {}

  @Post('reconsumption')
  @UseInterceptors(FilesInterceptor('paymentImages', 5))
  @UsePipes(new ValidationPipe({ transform: true }))
  createReconsumption(
    @GetUser() user,
    @Body() createDto: CreateReconsumptionDto,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png)$/,
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
    return this.reconsumptionService.createReconsumption(
      user.id,
      createDto,
      files,
    );
  }

  @Patch('auto-renewal')
  updateAutoRenewal(@GetUser() user, @Body() updateDto: UpdateAutoRenewalDto) {
    return this.reconsumptionService.updateAutoRenewal(user.id, updateDto);
  }
}
