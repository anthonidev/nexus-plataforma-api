import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { NotificationType } from '../entities/notification.entity';
import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({ example: [1, 2, 3], type: Array, required: true })
  @IsNotEmpty()
  ids: number[];
}

export class FindNotificationsDto extends PaginationDto {
  @ApiProperty({ example: 'NVOLUME_ADDED', type: String, required: false })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
  @ApiProperty({ example: false, type: Boolean, required: false })
  @IsOptional()
  isRead?: boolean;
}
