import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from 'src/user/entities/user.entity';
import { FindNotificationsDto, MarkAsReadDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Get()
  @ApiOperation({ summary: 'Obtener notificaciones' })
  @ApiResponse({ status: 200, description: 'Listado de notificaciones' })
  findAll(
    @GetUser() user: User,
    @Query() findNotificationsDto: FindNotificationsDto,
  ) {
    return this.notificationsService.findAllForUser(
      user.id,
      findNotificationsDto,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Obtener cantidad de notificaciones no leídas' })
  @ApiResponse({ status: 200, description: 'Cantidad de notificaciones no leídas' })
  getUnreadCount(@GetUser() user: User) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('mark-as-read')
  @ApiOperation({ summary: 'Marcar notificaciones como leídas' })
  @ApiResponse({ status: 200, description: 'Marcados como leídos' })
  markAsRead(@GetUser() user: User, @Body() markAsReadDto: MarkAsReadDto) {
    return this.notificationsService.markAsRead(user.id, markAsReadDto);
  }

  @Patch('mark-all-as-read')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiResponse({ status: 200, description: 'Marcados como leídos' })
  markAllAsRead(@GetUser() user: User) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar notificación' })
  @ApiParam({ name: 'id', type: String, description: 'ID de la notificación' })
  @ApiResponse({ status: 200, description: 'Notificación eliminada' })
  delete(@Param('id') id: string, @GetUser() user: User) {
    return this.notificationsService.deleteNotification(+id, user.id);
  }
}
