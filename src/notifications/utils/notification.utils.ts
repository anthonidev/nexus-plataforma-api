import { CreateNotificationDto } from '../dto/notification.dto';
import { NotificationType } from '../entities/notification.entity';

interface NotificationTemplateOptions {
  userId: string;
  metadata?: Record<string, any>;
  actionUrl?: string;
  imageUrl?: string;
}
export function createNotificationPayload(
  type: NotificationType,
  options: NotificationTemplateOptions,
): CreateNotificationDto {
  const { userId, metadata, actionUrl, imageUrl } = options;

  const templates = {
    [NotificationType.VOLUME_ADDED]: {
      title: 'Nuevo volumen registrado',
      message: `Se ha añadido ${metadata?.amount || ''} de volumen a tu ${metadata?.side === 'LEFT' ? 'pierna izquierda' : 'pierna derecha'}.`,
    },
    [NotificationType.COMMISSION_EARNED]: {
      title: 'Comisión recibida',
      message: `Has recibido una comisión de ${metadata?.amount || 0} por el corte semanal.`,
    },
    [NotificationType.RANK_ACHIEVED]: {
      title: 'Nuevo rango alcanzado',
      message: `¡Felicidades! Has alcanzado el rango ${metadata?.rankName || 'nuevo'}.`,
    },
    [NotificationType.REFERRAL_REGISTERED]: {
      title: 'Nuevo referido registrado',
      message: `${metadata?.referralName || 'Un nuevo usuario'} se ha registrado usando tu código de referido.`,
    },
    [NotificationType.PAYMENT_APPROVED]: {
      title: 'Pago aprobado',
      message: `Tu pago de ${metadata?.amount || ''} ha sido aprobado.`,
    },
    [NotificationType.PAYMENT_REJECTED]: {
      title: 'Pago rechazado',
      message: `Tu pago de ${metadata?.amount || ''} ha sido rechazado. Razón: ${metadata?.reason || 'No especificada'}.`,
    },
    [NotificationType.MEMBERSHIP_EXPIRING]: {
      title: 'Membresía próxima a vencer',
      message: `Tu membresía vencerá el ${metadata?.expiryDate || 'próximamente'}. Realiza tu reconsumo para mantenerla activa.`,
    },
    [NotificationType.POINTS_MOVEMENT]: {
      title: 'Movimiento de puntos',
      message: `${metadata?.operation === 'add' ? 'Se han añadido' : 'Se han deducido'} ${metadata?.amount || ''} puntos de tu cuenta.`,
    },
    [NotificationType.RECONSUMPTION_REMINDER]: {
      title: 'Recordatorio de reconsumo',
      message: `Tu fecha de reconsumo es ${metadata?.date || 'próximamente'}. No olvides realizar tu pago.`,
    },
    [NotificationType.SYSTEM_ANNOUNCEMENT]: {
      title: metadata?.title || 'Anuncio del sistema',
      message: metadata?.message || 'Hay un nuevo anuncio del sistema.',
    },
    [NotificationType.DIRECT_BONUS]: {
      title: 'Bono directo recibido',
      message: `Has recibido un bono directo de ${metadata?.amount || ''} por tu referido ${metadata?.referralName || ''}.`,
    },
    [NotificationType.MEMBERSHIP_UPGRADE]: {
      title: 'Membresía actualizada',
      message: `Tu membresía ha sido actualizada al plan ${metadata?.planName || 'nuevo plan'}.`,
    },
  };

  const template = templates[type] || {
    title: 'Nueva notificación',
    message: 'Tienes una nueva notificación.',
  };

  return {
    userId,
    type,
    title: template.title,
    message: template.message,
    actionUrl,
    imageUrl,
    metadata,
  };
}
