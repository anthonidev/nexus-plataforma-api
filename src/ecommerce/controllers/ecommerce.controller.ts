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
import { ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('ecommerce')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EcommerceController {
  constructor(private readonly ecommerceService: EcommerceService) { }

  @Get('categories')
  @Roles('SYS', 'FAC')
  @ApiOperation({ summary: 'Obtener categorías' })
  @ApiQuery({ name: 'includeInactive', type: Boolean, required: false })
  @ApiResponse({ status: 200, description: 'Listado de categorías' })
  async findAllCategories(
    @Query('includeInactive') includeInactive: boolean = false,
  ) {
    return this.ecommerceService.findAllCategories(includeInactive);
  }

  @Post('products')
  @Roles('SYS', 'FAC')
  @UseInterceptors(FilesInterceptor('productImages', 5))
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Crear producto' })
  @ApiResponse({ status: 200, description: 'Producto creado con éxito' })
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

  @Post('products/:id/images')
  @Roles('SYS', 'FAC')
  @UseInterceptors(FileInterceptor('image'))
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Agregar imagen a producto' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: Number, description: 'ID del producto' })
  @ApiResponse({ status: 200, description: 'Imagen agregada con éxito' })
  async addImageToProduct(
    @Param('id', ParseIntPipe) id: number,
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
    file: Express.Multer.File,
  ) {
    return this.ecommerceService.addImageToProduct(id, file);
  }

  @Put('products/:id')
  @Roles('SYS', 'FAC')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Actualizar producto' })
  @ApiResponse({ status: 200, description: 'Producto actualizado con éxito' })
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
  @ApiOperation({
    summary: 'Actualizar imagen de producto',
    description: 'Requiere rol SYS o FAC. Permite actualizar metadatos e imagen.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'productId', type: Number, description: 'ID del producto' })
  @ApiParam({ name: 'imageId', type: Number, description: 'ID de la imagen' })
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
  @ApiOperation({ summary: 'Eliminar imagen de producto' })
  @ApiParam({ name: 'productId', type: Number, description: 'ID del producto' })
  @ApiParam({ name: 'imageId', type: Number, description: 'ID de la imagen' })
  async deleteProductImage(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ) {
    return this.ecommerceService.deleteProductImage(productId, imageId);
  }
}
