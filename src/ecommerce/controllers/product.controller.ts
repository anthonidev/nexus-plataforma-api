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

  // SYS - FAC
  @Get()
  @Roles('SYS', 'FAC')
  @ApiOperation({ summary: 'Obtener productos' })
  @ApiResponse({ status: 200, description: 'Listado de productos' })
  findAll(@Query() findProductsDto: FindProductsDto) {
    return this.productService.findAll(findProductsDto);
  }

  @Get('sku-and-name')
  @Roles('SYS', 'FAC')
  @ApiOperation({ summary: 'Obtener productos con sku y nombre' })
  @ApiResponse({ status: 200, description: 'Listado de productos' })
  findAllWithSkuAndName() {
    return this.productService.findAllWithSkuAndName();
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

  // CLIENT
  @Get('list/with-clients')
  @Roles('CLI')
  @ApiOperation({ summary: 'Obtener productos para los usuarios clientes' })
  @ApiResponse({ status: 200, description: 'Listado de productos' })
  findAllWithClients(
    @Query() findProductsDto: FindProductsDto,
  ) {
    return this.productService.findAllWithClients(findProductsDto);
  }

  @Get(':id/item/with-clients')
  @Roles('CLI')
  @ApiOperation({ summary: 'Obtener producto para los usuarios clientes' })
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'Producto solicitado' })
  findOneWithClients(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.productService.findOneWithClients(id);
  }
}
