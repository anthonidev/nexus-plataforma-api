import { Injectable } from '@nestjs/common';
import { NotificationType } from '../entities/notification.entity';
import { NotificationsService } from '../notifications.service';
import { createNotificationPayload } from '../utils/notification.utils';

@Injectable()
export class NotificationFactory {
  constructor(private readonly notificationsService: NotificationsService) { }

  async send(
    type: NotificationType,
    userId: string,
    params: {
      metadata?: Record<string, any>;
      actionUrl?: string;
      imageUrl?: string;
      title?: string;
      message?: string;
    } = {},
  ) {
    try {
      const notificationPayload = createNotificationPayload(type, {
        userId,
        metadata: params.metadata,
        actionUrl: params.actionUrl,
        imageUrl: params.imageUrl,
      });

      if (params.title) {
        notificationPayload.title = params.title;
      }

      if (params.message) {
        notificationPayload.message = params.message;
      }

      return await this.notificationsService.create(notificationPayload);
    } catch (error) {
      console.error(
        `Error sending notification: ${error.message}`,
        error.stack,
      );
      return { error: error.message };
    }
  }


  async volumeAdded(userId: string, amount: number, side: 'LEFT' | 'RIGHT') {
    return this.send(NotificationType.VOLUME_ADDED, userId, {
      metadata: { amount, side },
      actionUrl: '/volumenes-semanales',
    });
  }

  async commissionEarned(userId: string, amount: number, periodInfo?: any) {
    return this.send(NotificationType.COMMISSION_EARNED, userId, {
      metadata: { amount, periodInfo },
      actionUrl: '/dashboard/earnings',
    });
  }

  async rankAchieved(userId: string, rankName: string, rankCode: string) {
    return this.send(NotificationType.RANK_ACHIEVED, userId, {
      metadata: { rankName, rankCode },
      actionUrl: '/dashboard/ranks',
    });
  }

  async referralRegistered(
    userId: string,
    referralName: string,
    referralId: string,
  ) {
    return this.send(NotificationType.REFERRAL_REGISTERED, userId, {
      metadata: { referralName, referralId },
      actionUrl: '/dashboard/network',
    });
  }

  async paymentApproved(
    userId: string,
    amount: number,
    paymentId: number,
    paymentType: string,
  ) {
    return this.send(NotificationType.PAYMENT_APPROVED, userId, {
      metadata: { amount, paymentId, paymentType },
      actionUrl: `/payments/${paymentId}`,
    });
  }

  async paymentRejected(
    userId: string,
    amount: number,
    paymentId: number,
    reason: string,
  ) {
    return this.send(NotificationType.PAYMENT_REJECTED, userId, {
      metadata: { amount, paymentId, reason },
      actionUrl: `/payments/${paymentId}`,
    });
  }

  async membershipExpiring(
    userId: string,
    expiryDate: Date,
    membershipId: number,
  ) {
    const formattedDate = expiryDate.toISOString().split('T')[0];
    return this.send(NotificationType.MEMBERSHIP_EXPIRING, userId, {
      metadata: { expiryDate: formattedDate, membershipId },
      actionUrl: '/memberships/renew',
    });
  }

  async pointsMovement(
    userId: string,
    operation: 'add' | 'subtract',
    amount: number,
    reason: string,
  ) {
    return this.send(NotificationType.POINTS_MOVEMENT, userId, {
      metadata: { operation, amount, reason },
      actionUrl: '/dashboard/points',
    });
  }

  async reconsumptionReminder(
    userId: string,
    date: Date,
    membershipId: number,
  ) {
    const formattedDate = date.toISOString().split('T')[0];
    return this.send(NotificationType.RECONSUMPTION_REMINDER, userId, {
      metadata: { date: formattedDate, membershipId },
      actionUrl: '/memberships/reconsumption',
    });
  }

  async systemAnnouncement(
    userId: string,
    title: string,
    message: string,
    actionUrl?: string,
  ) {
    return this.send(NotificationType.SYSTEM_ANNOUNCEMENT, userId, {
      metadata: { title, message },
      actionUrl,
      title,
      message,
    });
  }

  async directBonus(
    userId: string,
    amount: number,
    referralName: string,
    referralId: string,
  ) {
    return this.send(NotificationType.DIRECT_BONUS, userId, {
      metadata: { amount, referralName, referralId },
      actionUrl: '/dashboard/earnings',
    });
  }

  async membershipUpgrade(userId: string, planName: string, planId: number) {
    return this.send(NotificationType.MEMBERSHIP_UPGRADE, userId, {
      metadata: { planName, planId },
      actionUrl: '/memberships/detail',
    });
  }
}
