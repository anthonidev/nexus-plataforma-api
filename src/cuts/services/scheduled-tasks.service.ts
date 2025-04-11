import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CutsService } from './cuts.service';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(private readonly cutsService: CutsService) {}

  // Modificado para ejecutarse a las 11:15 del día actual (4/11/2025)
  @Cron('26 11 4 11 *', {
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

  // Modificado para ejecutarse a las 11:15 del día actual (4/11/2025)
  @Cron('26 11 4 11 *', {
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
}
