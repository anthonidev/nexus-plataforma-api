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

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Get()
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
  getUnreadCount(@GetUser() user: User) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('mark-as-read')
  markAsRead(@GetUser() user: User, @Body() markAsReadDto: MarkAsReadDto) {
    return this.notificationsService.markAsRead(user.id, markAsReadDto);
  }

  @Patch('mark-all-as-read')
  markAllAsRead(@GetUser() user: User) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @GetUser() user: User) {
    return this.notificationsService.deleteNotification(+id, user.id);
  }
}
