import { CutFrequency } from 'src/cuts/entities/cut_configurations.entity';

export const cutConfigurationsData = [
  {
    code: 'WEEKLY_VOLUME_CUT',
    name: 'Corte Semanal de Volumen',
    description: 'Procesa los volúmenes semanales y calcula comisiones',
    frequency: CutFrequency.WEEKLY,
    isActive: true,
    cronExpression: '0 3 * * 1', // Cada lunes a las 3:00 AM
    dayOfMonth: 0,
    dayOfWeek: 1, // Lunes
    hour: 3, // 3 AM
    minute: 0,
    parameters: {
      processLimit: 100,
      batchSize: 20,
    },
    serviceClassName: 'WeeklyVolumeService',
    methodName: 'processWeeklyVolumes',
  },
  {
    code: 'MONTHLY_VOLUME_CUT',
    name: 'Corte Mensual de Volumen',
    description: 'Procesa los volúmenes mensuales y actualiza rangos',
    frequency: CutFrequency.MONTHLY,
    isActive: true,
    cronExpression: '0 3 1 * *', // El día 1 de cada mes a las 3:00 AM
    dayOfMonth: 1,
    dayOfWeek: 0, // No aplica para mensual
    hour: 3, // 3 AM
    minute: 0,
    parameters: {
      processLimit: 100,
      batchSize: 20,
    },
    serviceClassName: 'MonthlyVolumeService',
    methodName: 'processMonthlyVolumes',
  },
  {
    code: 'MEMBERSHIP_STATUS_CUT',
    name: 'Corte de Estado de Membresía',
    description:
      'Actualiza el estado de las membresías según su fecha de expiración',
    frequency: CutFrequency.DAILY,
    isActive: true,
    cronExpression: '0 4 * * *', // Cada día a las 4:00 AM
    dayOfMonth: 0,
    dayOfWeek: 0,
    hour: 4, // 4 AM
    minute: 0,
    parameters: {
      updateExpired: true,
      notifyUsers: true,
    },
    serviceClassName: 'MembershipService',
    methodName: 'updateMembershipStatuses',
  },
  {
    code: 'PENDING_PAYMENTS_CUT',
    name: 'Corte de Pagos Pendientes',
    description:
      'Actualiza el estado de los pagos que no han sido procesados en un periodo de tiempo',
    frequency: CutFrequency.DAILY,
    isActive: true,
    cronExpression: '0 4 * * *', // Cada día a las 4:00 AM
    dayOfMonth: 0,
    dayOfWeek: 0,
    hour: 4, // 4 AM
    minute: 0,
    parameters: {
      dayThreshold: 30, // Número de días después del cual un pago pendiente se marca como expirado
      batchSize: 50,
    },
    serviceClassName: 'PaymentsService',
    methodName: 'processPendingPayments',
  },
  {
    code: 'PENDING_WITHDRAWALS_CUT',
    name: 'Corte de Retiros Pendientes',
    description:
      'Actualiza el estado de los retiros que no han sido procesados en un periodo de tiempo',
    frequency: CutFrequency.DAILY,
    isActive: true,
    cronExpression: '0 4 * * *', // Cada día a las 4:00 AM
    dayOfMonth: 0,
    dayOfWeek: 0,
    hour: 4, // 4 AM
    minute: 0,
    parameters: {
      dayThreshold: 15, // Número de días después del cual un retiro pendiente se marca como expirado
      batchSize: 50,
    },
    serviceClassName: 'WithdrawalsService',
    methodName: 'processPendingWithdrawals',
  },
];
