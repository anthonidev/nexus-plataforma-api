import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CutsService } from './cuts.service';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(private readonly cutsService: CutsService) {}

  @Cron('0 4 * * 1', {
    // @Cron('49 3 * * *', {
    name: 'weeklyVolumeCut',
    timeZone: 'America/Lima',
  })
  async handleWeeklyVolumeCut() {
    this.logger.log('Iniciando tarea programada: Corte semanal de volumen');
    try {
      await this.cutsService.executeCut('WEEKLY_VOLUME_CUT');
      this.logger.log('Tarea programada completada: Corte semanal de volumen');
    } catch (error) {
      this.logger.error(
        `Error en tarea programada: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron('0 3 1 * *', {
    // @Cron('1 0 1 6 *', {
    name: 'monthlyVolumeCut',
    timeZone: 'America/Lima',
  })
  async handleMonthlyVolumeCut() {
    this.logger.log('Iniciando tarea programada: Corte mensual de volumen');
    try {
      await this.cutsService.executeCut('MONTHLY_VOLUME_CUT');
      this.logger.log('Tarea programada completada: Corte mensual de volumen');
    } catch (error) {
      this.logger.error(
        `Error en tarea programada: ${error.message}`,
        error.stack,
      );
    }
  }
  @Cron('20 9 * * *', {
    name: 'reconsumptionCut',
    timeZone: 'America/Lima',
  })
  async handleReconsumptionCut() {
    this.logger.log('Iniciando tarea programada: Corte de reconsumición');
    try {
      await this.cutsService.executeCut('RECONSUMPTION_CUT');
      this.logger.log('Tarea programada completada: Corte de reconsumición');
    } catch (error) {
      this.logger.error(
        `Error en tarea programada: ${error.message}`,
        error.stack,
      );
    }
  }
}
