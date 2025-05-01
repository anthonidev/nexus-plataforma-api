import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  actionUrl?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateNotificationDto {
  @IsOptional()
  isRead?: boolean;
}

export class MarkAsReadDto {
  @IsNotEmpty()
  ids: number[];
}

export class FindNotificationsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
  @IsOptional()
  isRead?: boolean;
}
