import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CutConfiguration,
  CutFrequency,
} from '../entities/cut_configurations.entity';
import {
  CutExecution,
  CutExecutionStatus,
} from '../entities/cut_executions.entity';
import {
  CutExecutionLog,
  ExecutionAction,
  LogLevel,
} from '../entities/cut_execution_logs.entity';
import { WeeklyVolumeService } from './weekly-volume.service';
import { MonthlyVolumeService } from './monthly-volume.service';

@Injectable()
export class CutsService {
  private readonly logger = new Logger(CutsService.name);

  constructor(
    @InjectRepository(CutConfiguration)
    private readonly cutConfigRepository: Repository<CutConfiguration>,
    @InjectRepository(CutExecution)
    private readonly cutExecutionRepository: Repository<CutExecution>,
    @InjectRepository(CutExecutionLog)
    private readonly cutExecutionLogRepository: Repository<CutExecutionLog>,
    private readonly weeklyVolumeService: WeeklyVolumeService,
    private readonly monthlyVolumeService: MonthlyVolumeService,
  ) {}

  async executeCut(configCode: string): Promise<CutExecution> {
    this.logger.log(`Iniciando ejecución de corte: ${configCode}`);

    const config = await this.cutConfigRepository.findOne({
      where: { code: configCode, isActive: true },
    });

    if (!config) {
      throw new Error(
        `Configuración de corte con código ${configCode} no encontrada o inactiva`,
      );
    }

    // Crear una nueva ejecución de corte
    const execution = this.cutExecutionRepository.create({
      configuration: config,
      status: CutExecutionStatus.PROCESSING,
      executionDate: new Date(),
      startDate: this.calculateStartDate(config.frequency),
      endDate: this.calculateEndDate(config.frequency),
      startedAt: new Date(),
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      totalProcessed: 0,
      parameters: config.parameters,
    });

    const savedExecution = await this.cutExecutionRepository.save(execution);

    // Registrar el inicio de la ejecución
    await this.logExecution(
      savedExecution.id,
      LogLevel.INFO,
      ExecutionAction.EXECUTION_STARTED,
      `Iniciando ejecución de corte ${config.name}`,
      {
        configId: config.id,
        configCode: config.code,
        parameters: config.parameters,
      },
    );

    try {
      let result;

      switch (config.code) {
        case 'WEEKLY_VOLUME_CUT':
          result = await this.weeklyVolumeService.processWeeklyVolumes();
          break;

        case 'MONTHLY_VOLUME_CUT':
          result = await this.monthlyVolumeService.processMonthlyVolumes();
          break;
        // Otros tipos de cortes
        default:
          throw new Error(`Tipo de corte no implementado: ${config.code}`);
      }

      // Actualizar la ejecución con los resultados
      savedExecution.status = CutExecutionStatus.COMPLETED;
      savedExecution.finishedAt = new Date();
      savedExecution.processedRecords = result.processed;
      savedExecution.successfulRecords = result.successful;
      savedExecution.failedRecords = result.failed;
      savedExecution.totalProcessed = result.totalPoints;
      savedExecution.results = result;

      const updatedExecution =
        await this.cutExecutionRepository.save(savedExecution);

      // Registrar la finalización exitosa de la ejecución
      await this.logExecution(
        updatedExecution.id,
        LogLevel.INFO,
        ExecutionAction.EXECUTION_COMPLETED,
        `Ejecución completada exitosamente: ${result.successful}/${result.processed} registros procesados correctamente`,
        result,
      );

      return updatedExecution;
    } catch (error) {
      this.logger.error(
        `Error durante la ejecución del corte ${configCode}: ${error.message}`,
        error.stack,
      );

      // Actualizar la ejecución con el error
      savedExecution.status = CutExecutionStatus.FAILED;
      savedExecution.finishedAt = new Date();
      savedExecution.errorMessage = error.message;

      const failedExecution =
        await this.cutExecutionRepository.save(savedExecution);

      // Registrar el error
      await this.logExecution(
        failedExecution.id,
        LogLevel.ERROR,
        ExecutionAction.EXECUTION_FAILED,
        `Error durante la ejecución: ${error.message}`,
        {
          errorStack: error.stack,
        },
      );

      throw error;
    }
  }

  private async logExecution(
    executionId: number,
    level: LogLevel,
    action: ExecutionAction,
    message: string,
    data: any = null,
  ): Promise<void> {
    const log = this.cutExecutionLogRepository.create({
      execution: { id: executionId },
      level,
      action,
      message,
      data,
    });

    await this.cutExecutionLogRepository.save(log);
  }

  private calculateStartDate(frequency: CutFrequency): Date {
    const now = new Date();
    const startDate = new Date(now);

    switch (frequency) {
      case CutFrequency.DAILY:
        startDate.setDate(now.getDate() - 1);
        break;
      case CutFrequency.WEEKLY:
        // Inicio de la semana anterior (lunes)
        const day = now.getDay() || 7; // Transformar 0 (domingo) a 7
        startDate.setDate(now.getDate() - day - 6);
        break;
      case CutFrequency.MONTHLY:
        // Inicio del mes anterior
        startDate.setMonth(now.getMonth() - 1);
        startDate.setDate(1);
        break;
      case CutFrequency.QUARTERLY:
        // Inicio del trimestre anterior
        const currentMonth = now.getMonth();
        const currentQuarter = Math.floor(currentMonth / 3);
        startDate.setMonth(currentQuarter * 3 - 3);
        startDate.setDate(1);
        break;
      case CutFrequency.YEARLY:
        // Inicio del año anterior
        startDate.setFullYear(now.getFullYear() - 1);
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      default:
        // Por defecto, un día atrás
        startDate.setDate(now.getDate() - 1);
    }

    startDate.setHours(0, 0, 0, 0);
    return startDate;
  }

  private calculateEndDate(frequency: CutFrequency): Date {
    const now = new Date();
    const endDate = new Date(now);

    switch (frequency) {
      case CutFrequency.DAILY:
        // Fin del día anterior
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case CutFrequency.WEEKLY:
        // Fin de la semana anterior (domingo)
        const day = now.getDay() || 7; // Transformar 0 (domingo) a 7
        endDate.setDate(now.getDate() - day);
        endDate.setHours(23, 59, 59, 999);
        break;
      case CutFrequency.MONTHLY:
        // Fin del mes anterior
        endDate.setDate(0); // Último día del mes anterior
        endDate.setHours(23, 59, 59, 999);
        break;
      case CutFrequency.QUARTERLY:
        // Fin del trimestre anterior
        const currentMonth = now.getMonth();
        const currentQuarter = Math.floor(currentMonth / 3);
        endDate.setMonth(currentQuarter * 3);
        endDate.setDate(0); // Último día del último mes del trimestre anterior
        endDate.setHours(23, 59, 59, 999);
        break;
      case CutFrequency.YEARLY:
        // Fin del año anterior
        endDate.setFullYear(now.getFullYear() - 1);
        endDate.setMonth(11);
        endDate.setDate(31);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        // Por defecto, hasta ahora
        endDate.setHours(23, 59, 59, 999);
    }

    return endDate;
  }

  async fixBinaryCommissionPayments(weekEndDate: Date) {
    this.logger.log(
      `Fixing binary commission payments for week ending: ${weekEndDate}`,
    );
    const result =
      await this.weeklyVolumeService.fixBinaryCommissionPayments(weekEndDate);
    this.logger.log(
      `Binary commission payments fixed for week ending: ${weekEndDate}`,
    );
    return result;
  }
}
