import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { User } from 'src/user/entities/user.entity';
import { OrdersService } from '../services/orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }
  // FAC - SYS
  @Get('list')
  @Roles('FAC')
  @ApiOperation({ summary: 'Obtener lista de ordenes' })
  @ApiResponse({ status: 200, description: 'Listado de ordenes' })
  findAll(
    @Query() paginationDto: PaginationDto,
  ) {
    return this.ordersService.findAll(paginationDto);
  }

  @Get(':id/item')
  @Roles('FAC')
  @ApiOperation({ summary: 'Obtener orden' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del orden' })
  @ApiResponse({ status: 200, description: 'Orden' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.findOne(id);
  }
  // CLIENTS
  @Get('list/with-clients')
  @Roles('CLI')
  @ApiOperation({ summary: 'Obtener lista de ordenes del usuario en sesión' })
  @ApiResponse({ status: 200, description: 'Listado de ordenes del usuario' })
  findAllWithClients(
    @GetUser() user: User,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.ordersService.findAllWithClients(user.id, paginationDto);
  }

  @Get(':id/item/with-clients')
  @Roles('CLI')
  @ApiOperation({ summary: 'Obtener orden del usuario en sesión' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del orden' })
  @ApiResponse({ status: 200, description: 'Orden del usuario' })
  findOneWithClients(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.findOneWithClients(id, user.id);
  }
}
