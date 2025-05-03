import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { ProductService } from '../services/product.service';
import { FindProductsDto } from '../dto/filter-products.dto';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Get()
  @Roles('SYS', 'FAC')
  @ApiOperation({ summary: 'Obtener productos' })
  @ApiResponse({ status: 200, description: 'Listado de productos' })
  findAll(@Query() findProductsDto: FindProductsDto) {
    return this.productService.findAll(findProductsDto);
  }

  @Get(':id')
  @Roles('SYS', 'FAC')
  @ApiOperation({ summary: 'Obtener producto' })
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'Producto solicitado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findOne(id);
  }

  @Get(':id/stock-history')
  @Roles('SYS', 'FAC')
  @ApiOperation({ summary: 'Obtener historial de stock' })
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'Historial de stock' })
  findStockHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.productService.findStockHistory(id, paginationDto);
  }
}
