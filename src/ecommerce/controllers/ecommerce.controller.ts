import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { User } from 'src/user/entities/user.entity';
import { CreateProductDto } from '../dto/create-ecommerce.dto';
import { UpdateImageDto, UpdateProductDto } from '../dto/update-ecommerce.dto';
import { EcommerceService } from '../services/ecommerce.service';

@Controller('ecommerce')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EcommerceController {
  constructor(private readonly ecommerceService: EcommerceService) { }

  @Get('categories')
  @Roles('SYS', 'FAC')
  async findAllCategories(
    @Query('includeInactive') includeInactive: boolean = false,
  ) {
    return this.ecommerceService.findAllCategories(includeInactive);
  }

  @Post('products')
  @Roles('SYS', 'FAC')
  @UseInterceptors(FilesInterceptor('productImages', 5))
  @UsePipes(new ValidationPipe({ transform: true }))
  async createProduct(
    @GetUser() user: User,
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 2,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    files: Array<Express.Multer.File> = [],
  ) {
    return this.ecommerceService.createProduct(
      createProductDto,
      files,
      user.id,
    );
  }

  @Put('products/:id')
  @Roles('SYS', 'FAC')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.ecommerceService.updateProduct(id, updateProductDto);
  }

  @Patch('products/:productId/images/:imageId')
  @Roles('SYS', 'FAC')
  @UseInterceptors(FileInterceptor('image'))
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateProductImage(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Body() updateImageDto: UpdateImageDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file?: Express.Multer.File,
  ) {
    return this.ecommerceService.updateProductImage(
      productId,
      imageId,
      updateImageDto,
      file,
    );
  }

  @Delete('products/:productId/images/:imageId')
  @Roles('SYS', 'FAC')
  async deleteProductImage(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ) {
    return this.ecommerceService.deleteProductImage(productId, imageId);
  }
}
