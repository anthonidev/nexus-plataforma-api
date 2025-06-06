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
    cronExpression: '0 3 1 * *',
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
    code: 'RECONSUMPTION_CUT',
    name: 'Corte de Reconsumición',
    description: 'Procesa las reconsumiciones de membresía',
    frequency: CutFrequency.DAILY,
    isActive: true,
    cronExpression: '0 4 * * *', // Cada día a las 4:00 AM
    dayOfMonth: 0,
    dayOfWeek: 0, // No aplica para diario
    hour: 4, // 4 AM
    minute: 0,
    parameters: {
      processLimit: 100,
      batchSize: 20,
    },
    serviceClassName: 'ReconsumptionService',
    methodName: 'processReconsumptions',
  },
];
