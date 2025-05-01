import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { In, Repository } from 'typeorm';
import {
  CreateNotificationDto,
  FindNotificationsDto,
  MarkAsReadDto,
} from './dto/notification.dto';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private eventEmitter: EventEmitter2,
  ) { }

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      user: { id: createNotificationDto.userId },
      type: createNotificationDto.type,
      title: createNotificationDto.title,
      message: createNotificationDto.message,
      actionUrl: createNotificationDto.actionUrl,
      imageUrl: createNotificationDto.imageUrl,
      metadata: createNotificationDto.metadata,
    });

    const savedNotification =
      await this.notificationRepository.save(notification);

    // Emitir un evento para la notificación en tiempo real
    this.eventEmitter.emit('notification.created', {
      userId: createNotificationDto.userId,
      notification: savedNotification,
    });

    return savedNotification;
  }

  async findAllForUser(
    userId: string,
    findNotificationsDto: FindNotificationsDto,
  ) {
    const { limit = 10, page = 1, type, isRead } = findNotificationsDto;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.user.id = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (type) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    if (isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead });
    }

    const [items, totalItems] = await queryBuilder.getManyAndCount();

    return PaginationHelper.createPaginatedResponse(items, totalItems, {
      limit,
      page,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: {
        user: { id: userId },
        isRead: false,
      },
    });
  }

  async markAsRead(userId: string, markAsReadDto: MarkAsReadDto) {
    if (!markAsReadDto.ids || markAsReadDto.ids.length === 0) {
      return { success: false, message: 'No IDs provided' };
    }

    const result = await this.notificationRepository.update(
      {
        id: In(markAsReadDto.ids),
        user: { id: userId },
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return {
      success: result.affected > 0,
      message: `${result.affected} notification(s) marked as read`,
    };
  }

  async markAllAsRead(userId: string) {
    const result = await this.notificationRepository.update(
      { user: { id: userId }, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    return {
      success: true,
      message: `${result.affected} notification(s) marked as read`,
    };
  }

  async deleteNotification(id: number, userId: string) {
    const result = await this.notificationRepository.delete({
      id,
      user: { id: userId },
    });

    return {
      success: result.affected > 0,
      message:
        result.affected > 0
          ? 'Notification deleted successfully'
          : 'Notification not found',
    };
  }
}
