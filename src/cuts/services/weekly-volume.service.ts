import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { PointsTransactionPayment } from 'src/points/entities/points-transactions-payments.entity';
import {
  PointsTransaction,
  PointTransactionStatus,
  PointTransactionType,
} from 'src/points/entities/points_transactions.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { WeeklyVolumesHistory } from 'src/points/entities/weekly-volumes-history.entity';
import {
  VolumeProcessingStatus,
  VolumeSide,
  WeeklyVolume,
} from 'src/points/entities/weekly_volumes.entity';
import { User } from 'src/user/entities/user.entity';
import {
  getFirstDayOfPreviousWeek,
  getFirstDayOfWeek,
  getLastDayOfPreviousWeek,
  getLastDayOfWeek,
} from 'src/utils/dates';
import { Between, DataSource, Repository } from 'typeorm';

@Injectable()
export class WeeklyVolumeService {
  private readonly logger = new Logger(WeeklyVolumeService.name);
  private readonly reportRecipients = [
    'softwaretoni21@gmail.com',
    'tonirodriguez110@gmail.com',
  ];

  constructor(
    @InjectRepository(WeeklyVolume)
    private readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
    @InjectRepository(WeeklyVolumesHistory)
    private readonly weeklyVolumesHistoryRepository: Repository<WeeklyVolumesHistory>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(PointsTransactionPayment)
    private readonly pointsTransactionPaymentRepository: Repository<PointsTransactionPayment>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  async processWeeklyVolumes(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    totalPoints: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Iniciando procesamiento de volúmenes semanales');

      const lastWeekDates = this.getLastWeekDates();

      const pendingVolumes = await this.weeklyVolumeRepository.find({
        where: {
          status: VolumeProcessingStatus.PENDING,
          weekStartDate: lastWeekDates.start,
          weekEndDate: lastWeekDates.end,
        },
        relations: [
          'user',
          'membershipPlan',
          'user.leftChild',
          'user.rightChild',
        ],
      });

      this.logger.log(
        `Encontrados ${pendingVolumes.length} volúmenes pendientes para procesar`,
      );

      let processed = 0;
      let successful = 0;
      let failed = 0;
      let totalPoints = 0;

      const currentWeekDates = this.getCurrentWeekDates();

      for (const volume of pendingVolumes) {
        try {
          const activeMembership = await this.membershipRepository.findOne({
            where: {
              user: { id: volume.user.id },
              status: MembershipStatus.ACTIVE,
            },
            relations: ['plan'],
          });

          if (!activeMembership) {
            this.logger.warn(
              `Usuario ${volume.user.id} no tiene una membresía activa`,
            );
            volume.status = VolumeProcessingStatus.CANCELLED;
            volume.metadata = {
              Razón: 'Membresía inactiva',
              'Procesado en': new Date().toISOString().split('T')[0],
              'Volumen izquierdo': volume.leftVolume,
              'Volumen derecho': volume.rightVolume,
            };
            await queryRunner.manager.save(volume);

            const existingNextWeekVolume =
              await this.weeklyVolumeRepository.findOne({
                where: {
                  user: { id: volume.user.id },
                  weekStartDate: currentWeekDates.start,
                  weekEndDate: currentWeekDates.end,
                },
              });

            if (existingNextWeekVolume) {
              this.logger.log(
                `Ya existe un volumen para la siguiente semana para el usuario ${volume.user.id}`,
              );
            } else {
              const newVolume = this.weeklyVolumeRepository.create({
                user: { id: volume.user.id },
                membershipPlan: volume.membershipPlan,
                leftVolume: 0,
                rightVolume: 0,
                weekStartDate: currentWeekDates.start,
                weekEndDate: currentWeekDates.end,
                status: VolumeProcessingStatus.PENDING,
                carryOverVolume: 0,
              });

              await queryRunner.manager.save(newVolume);
            }

            processed++;
            failed++;
            continue;
          }

          const hasLeftLeg = await this.checkLeg(volume.user.id, 'LEFT');
          const hasRightLeg = await this.checkLeg(volume.user.id, 'RIGHT');

          if (!hasLeftLeg || !hasRightLeg) {
            this.logger.warn(
              `Usuario ${volume.user.id} no tiene hijos en ambos lados`,
            );

            // Cambiar a CANCELLED en lugar de PROCESSED
            volume.status = VolumeProcessingStatus.CANCELLED;

            // Añadir metadatos sobre la razón
            volume.metadata = {
              Razón:
                !hasLeftLeg && !hasRightLeg
                  ? 'No tiene directos activos en ninguna pierna'
                  : !hasLeftLeg
                    ? 'No tiene directo activo en la pierna izquierda'
                    : 'No tiene directo activo en la pierna derecha',

              'Procesado en': new Date().toISOString().split('T')[0],
              'Volumen izquierdo': volume.leftVolume,
              'Volumen derecho': volume.rightVolume,
            };

            await queryRunner.manager.save(volume);

            let carryOverVolume = volume.leftVolume + volume.rightVolume;

            const existingNextWeekVolume =
              await this.weeklyVolumeRepository.findOne({
                where: {
                  user: { id: volume.user.id },
                  weekStartDate: currentWeekDates.start,
                  weekEndDate: currentWeekDates.end,
                },
              });

            if (existingNextWeekVolume) {
              existingNextWeekVolume.carryOverVolume =
                Number(existingNextWeekVolume.carryOverVolume) +
                carryOverVolume;
              existingNextWeekVolume.leftVolume =
                Number(existingNextWeekVolume.leftVolume) + carryOverVolume;
              existingNextWeekVolume.rightVolume =
                Number(existingNextWeekVolume.rightVolume) + carryOverVolume;
              existingNextWeekVolume.status = VolumeProcessingStatus.PENDING;
              existingNextWeekVolume.metadata = {
                Razón: 'Volumen transferido',
                'Procesado en': new Date().toISOString().split('T')[0],
                'Volumen izquierdo': existingNextWeekVolume.leftVolume,
                'Volumen derecho': existingNextWeekVolume.rightVolume,
                'Volumen transferido': carryOverVolume,
              };

              await queryRunner.manager.save(existingNextWeekVolume);
            } else {
              // Si no existe, crear uno nuevo
              const newVolume = this.weeklyVolumeRepository.create({
                user: { id: volume.user.id },
                membershipPlan: activeMembership.plan,
                leftVolume: volume.leftVolume,
                rightVolume: volume.rightVolume,
                weekStartDate: currentWeekDates.start,
                weekEndDate: currentWeekDates.end,
                status: VolumeProcessingStatus.PENDING,
                carryOverVolume: carryOverVolume,
                metadata: {
                  Razón: 'Volumen transferido',
                  'Procesado en': new Date().toISOString().split('T')[0],
                  'Volumen izquierdo': volume.leftVolume,
                  'Volumen derecho': volume.rightVolume,
                  'Volumen transferido': carryOverVolume,
                },
              });

              await queryRunner.manager.save(newVolume);
            }

            processed++;
            failed++;
            continue;
          }

          let higherSide: VolumeSide;
          let lowerSide: VolumeSide;

          if (volume.leftVolume >= volume.rightVolume) {
            higherSide = VolumeSide.LEFT;
            lowerSide = VolumeSide.RIGHT;
          } else {
            higherSide = VolumeSide.RIGHT;
            lowerSide = VolumeSide.LEFT;
          }

          volume.selectedSide = lowerSide;

          const commissionPercentage =
            activeMembership.plan.commissionPercentage / 100;
          const higherVolume =
            higherSide === VolumeSide.LEFT
              ? volume.leftVolume
              : volume.rightVolume;
          const lowerVolume =
            lowerSide === VolumeSide.LEFT
              ? volume.leftVolume
              : volume.rightVolume;

          const { directCount } = await this.countDirectReferrals(
            volume.user.id,
          );

          let effectiveLowerVolume = lowerVolume;

          if (directCount >= 5) {
            effectiveLowerVolume = Math.min(lowerVolume, 250000);
          } else if (directCount >= 4) {
            effectiveLowerVolume = Math.min(lowerVolume, 150000);
          } else if (directCount >= 3) {
            effectiveLowerVolume = Math.min(lowerVolume, 50000);
          } else if (directCount >= 2) {
            effectiveLowerVolume = Math.min(lowerVolume, 12500);
          } else {
            // Con 0 o 1 referidos, no hay límite (o usamos el valor original)
            effectiveLowerVolume = lowerVolume;
          }
          const pointsToAdd = effectiveLowerVolume * commissionPercentage;

          volume.status = VolumeProcessingStatus.PROCESSED;
          volume.paidAmount = pointsToAdd;

          let userPoints = await this.userPointsRepository.findOne({
            where: { user: { id: volume.user.id } },
          });

          if (!userPoints) {
            userPoints = this.userPointsRepository.create({
              user: { id: volume.user.id },
              membershipPlan: activeMembership.plan,
              availablePoints: 0,
              totalEarnedPoints: 0,
              totalWithdrawnPoints: 0,
            });
          }

          userPoints.availablePoints =
            Number(userPoints.availablePoints) + pointsToAdd;
          userPoints.totalEarnedPoints =
            Number(userPoints.totalEarnedPoints) + pointsToAdd;

          await queryRunner.manager.save(userPoints);

          const pointsTransaction = this.pointsTransactionRepository.create({
            user: { id: volume.user.id },
            membershipPlan: activeMembership.plan,
            amount: pointsToAdd,
            type: PointTransactionType.BINARY_COMMISSION,
            status: PointTransactionStatus.COMPLETED,
            metadata: {
              'Fecha de inicio de semana': volume.weekStartDate,
              'Fecha de fin de semana': volume.weekEndDate,
              'Volumen izquierdo': volume.leftVolume,
              'Volumen derecho': volume.rightVolume,
              'Selección de lado':
                volume.selectedSide === VolumeSide.LEFT
                  ? 'Izquierdo'
                  : 'Derecho',
              'Porcentaje de comisión':
                activeMembership.plan.commissionPercentage,
              'Directos activos': directCount,
              'Volumen efectivo menor': effectiveLowerVolume,
              'Volumen menor original': lowerVolume,
              'Limite aplicado':
                lowerVolume !== effectiveLowerVolume
                  ? 'Limite aplicado'
                  : 'Sin limite',
            },
          });
          volume.metadata = {
            Razón: 'Comisión binaria procesada',
            'Procesado en': new Date().toISOString().split('T')[0],
            'Volumen izquierdo': volume.leftVolume,
            'Volumen derecho': volume.rightVolume,
            'Comisión procesada': pointsToAdd,
          };
          console.log('Volumen ID:', volume.id);
          console.log('Volumen Seleccionado:', volume.selectedSide);
          console.log('lowerSide:', lowerSide);

          const volumeHistorySelect =
            await this.weeklyVolumesHistoryRepository.find({
              where: {
                selectedSide: lowerSide,
                weeklyVolumes: { id: volume.id },
              },
              select: {
                id: true,
                payment: { id: true },
              },
              relations: ['payment'],
            });

          console.log('Volume History Select:', volumeHistorySelect);
          await queryRunner.manager.save(pointsTransaction);

          if (volumeHistorySelect.length > 0) {
            console.log(
              'Procesando historial de volúmenes:',
              volumeHistorySelect.length,
            );
            for (const history of volumeHistorySelect) {
              console.log('Procesando historial de volumen:', history.id);
              if (history.payment) {
                const pointsTransactionPayment =
                  this.pointsTransactionPaymentRepository.create({
                    pointsTransaction: pointsTransaction,
                    payment: { id: history.payment.id },
                  });
                await queryRunner.manager.save(pointsTransactionPayment);
              }
            }
          }

          const carryOverVolume = Math.max(0, higherVolume - lowerVolume);

          const existingNextWeekVolume =
            await this.weeklyVolumeRepository.findOne({
              where: {
                user: { id: volume.user.id },
                weekStartDate: currentWeekDates.start,
                weekEndDate: currentWeekDates.end,
              },
            });

          if (existingNextWeekVolume) {
            if (higherSide === VolumeSide.LEFT) {
              existingNextWeekVolume.leftVolume =
                Number(existingNextWeekVolume.leftVolume) + carryOverVolume;
            } else {
              existingNextWeekVolume.rightVolume =
                Number(existingNextWeekVolume.rightVolume) + carryOverVolume;
            }

            existingNextWeekVolume.carryOverVolume =
              Number(existingNextWeekVolume.carryOverVolume) + carryOverVolume;

            await queryRunner.manager.save(existingNextWeekVolume);

            this.logger.log(
              `Actualizado volumen existente para la siguiente semana: ID ${existingNextWeekVolume.id}, sumando carryOver: ${carryOverVolume}`,
            );
          } else {
            const newVolume = this.weeklyVolumeRepository.create({
              user: { id: volume.user.id },
              membershipPlan: activeMembership.plan,
              leftVolume: higherSide === VolumeSide.LEFT ? carryOverVolume : 0,
              rightVolume:
                higherSide === VolumeSide.RIGHT ? carryOverVolume : 0,
              weekStartDate: currentWeekDates.start,
              weekEndDate: currentWeekDates.end,
              status: VolumeProcessingStatus.PENDING,
              carryOverVolume: carryOverVolume,
            });

            await queryRunner.manager.save(newVolume);
          }

          await queryRunner.manager.save(volume);

          successful++;
          totalPoints += pointsToAdd;
        } catch (error) {
          this.logger.error(
            `Error procesando volumen ${volume.id}: ${error.message}`,
          );
          failed++;
        }

        processed++;
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Procesamiento de volúmenes completado. Procesados: ${processed}, Exitosos: ${successful}, Fallidos: ${failed}, Puntos totales: ${totalPoints}`,
      );

      await this.sendWeeklyVolumeReport({
        processed,
        successful,
        failed,
        totalPoints,
        weekStartDate: lastWeekDates.start,
        weekEndDate: lastWeekDates.end,
      });

      return {
        processed,
        successful,
        failed,
        totalPoints,
      };
    } catch (error) {
      this.logger.error(
        `Error general en procesamiento de volúmenes: ${error.message}`,
      );
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async sendWeeklyVolumeReport(reportData: {
    processed: number;
    successful: number;
    failed: number;
    totalPoints: number;
    weekStartDate: Date;
    weekEndDate: Date;
  }): Promise<void> {
    try {
      const formattedStartDate = reportData.weekStartDate
        .toISOString()
        .split('T')[0];
      const formattedEndDate = reportData.weekEndDate
        .toISOString()
        .split('T')[0];

      // Obtener información adicional para el reporte
      const topEarners = await this.getTopEarnersForWeek(
        reportData.weekStartDate,
        reportData.weekEndDate,
        5, // Limitar a los 5 principales
      );

      const weeklyStats = await this.getWeeklyStats(
        reportData.weekStartDate,
        reportData.weekEndDate,
      );

      const subject = `Reporte de Comisiones Binarias: ${formattedStartDate} al ${formattedEndDate}`;

      const successRate =
        reportData.processed > 0
          ? ((reportData.successful / reportData.processed) * 100).toFixed(2)
          : 0;

      const avgPointsPerUser =
        reportData.successful > 0
          ? (reportData.totalPoints / reportData.successful).toFixed(2)
          : 0;

      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reporte Semanal de Comisiones</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; margin-bottom: 20px;">
            <tr>
              <td style="padding: 20px;">
                <h1 style="color: #0a8043; margin: 0; padding: 0; font-size: 24px;">Reporte de Comisiones Binarias</h1>
                <p style="font-size: 16px; color: #666; margin-top: 5px;">
                  <strong>Período:</strong> ${formattedStartDate} al ${formattedEndDate}
                </p>
              </td>
            </tr>
          </table>
          
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 0 0 20px 0;">
                <h2 style="color: #0a8043; font-size: 18px; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Resumen Ejecutivo
                </h2>
                
                <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td width="50%" style="background-color: #effaf5; border-radius: 4px; padding: 15px;">
                      <p style="font-size: 28px; font-weight: bold; margin: 0; color: #0a8043;">${reportData.totalPoints.toFixed(2)}</p>
                      <p style="font-size: 14px; margin: 5px 0 0 0; color: #666;">Total puntos distribuidos</p>
                    </td>
                    <td width="50%" style="background-color: #f8f9fa; border-radius: 4px; padding: 15px;">
                      <p style="font-size: 28px; font-weight: bold; margin: 0; color: #0a8043;">${reportData.successful}</p>
                      <p style="font-size: 14px; margin: 5px 0 0 0; color: #666;">Usuarios recompensados</p>
                    </td>
                  </tr>
                </table>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                  <tr>
                    <td width="33%" style="padding: 0 10px 0 0;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${avgPointsPerUser}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Promedio de puntos por usuario</p>
                      </div>
                    </td>
                    <td width="33%" style="padding: 0 10px;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${successRate}%</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Tasa de éxito</p>
                      </div>
                    </td>
                    <td width="33%" style="padding: 0 0 0 10px;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: ${reportData.failed > 0 ? '#dc3545' : '#0a8043'}">${reportData.failed}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Procesamientos fallidos</p>
                      </div>
                    </td>
                  </tr>
                </table>
  
                ${
                  weeklyStats
                    ? `
                <h2 style="color: #0a8043; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Métricas Semanales
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                  <tr>
                    <td width="33%" style="padding: 0 10px 0 0;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${weeklyStats.totalVolume.toFixed(2)}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Volumen total generado</p>
                      </div>
                    </td>
                    <td width="33%" style="padding: 0 10px;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${weeklyStats.leftVolume.toFixed(2)}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Volumen izquierdo total</p>
                      </div>
                    </td>
                    <td width="33%" style="padding: 0 0 0 10px;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${weeklyStats.rightVolume.toFixed(2)}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Volumen derecho total</p>
                      </div>
                    </td>
                  </tr>
                </table>
                `
                    : ''
                }
  
                ${
                  topEarners.length > 0
                    ? `
                <h2 style="color: #0a8043; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Top ${topEarners.length} Comisiones
                </h2>
                <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                  <tr style="background-color: #effaf5; font-weight: bold;">
                    <th style="text-align: left; padding: 10px; border-bottom: 1px solid #dee2e6;">Usuario</th>
                    <th style="text-align: right; padding: 10px; border-bottom: 1px solid #dee2e6;">Puntos</th>
                    <th style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">Volumen Izq.</th>
                    <th style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">Volumen Der.</th>
                  </tr>
                  ${topEarners
                    .map(
                      (earner, index) => `
                  <tr style="background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'};">
                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${earner.user}</td>
                    <td style="text-align: right; padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: bold;">${earner.points.toFixed(2)}</td>
                    <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">${earner.leftVolume.toFixed(2)}</td>
                    <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">${earner.rightVolume.toFixed(2)}</td>
                  </tr>
                  `,
                    )
                    .join('')}
                </table>
                `
                    : ''
                }
                
                <h2 style="color: #0a8043; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Detalles del Procesamiento
                </h2>
                <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
                  <tr style="background-color: #effaf5; font-weight: bold;">
                    <th style="text-align: left; padding: 10px; border: 1px solid #dee2e6;">Métrica</th>
                    <th style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">Valor</th>
                  </tr>
                  <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Volúmenes a procesar</td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">${reportData.processed}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Procesamientos exitosos</td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">${reportData.successful}</td>
                  </tr>
                  <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Procesamientos fallidos</td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">${reportData.failed}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Total de puntos distribuidos</strong></td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;"><strong>${reportData.totalPoints.toFixed(2)}</strong></td>
                  </tr>
                  <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Tasa de éxito</td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">${successRate}%</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; margin-top: 30px;">
            <tr>
              <td style="padding: 20px; text-align: center; color: #6c757d;">
                <p style="font-size: 14px; margin: 0;">
                  Este es un correo automático generado por el sistema de Nexus Platform.<br>
                  Por favor no responda a este correo.
                </p>
                <p style="font-size: 12px; margin: 10px 0 0 0;">
                  © ${new Date().getFullYear()} Nexus Platform. Todos los derechos reservados.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await this.mailService.sendMail({
        to: this.reportRecipients,
        subject,
        html,
      });

      this.logger.log(
        `Reporte de volúmenes semanales enviado a: ${this.reportRecipients.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(`Error al enviar reporte por email: ${error.message}`);
      // No lanzamos el error para que no interrumpa el flujo principal
    }
  }

  // Método para obtener los usuarios con mayores comisiones de la semana
  private async getTopEarnersForWeek(
    startDate: Date,
    endDate: Date,
    limit: number = 5,
  ): Promise<
    Array<{
      user: string;
      points: number;
      leftVolume: number;
      rightVolume: number;
    }>
  > {
    try {
      // Obtener las transacciones de puntos del tipo comisión binaria en el período
      const transactions = await this.pointsTransactionRepository.find({
        where: {
          type: PointTransactionType.BINARY_COMMISSION,
          status: PointTransactionStatus.COMPLETED,
          createdAt: Between(startDate, endDate),
        },
        relations: ['user', 'user.personalInfo'],
        order: { amount: 'DESC' },
        take: limit,
      });

      return transactions.map((transaction) => {
        const userName = transaction.user.personalInfo
          ? `${transaction.user.personalInfo.firstName} ${transaction.user.personalInfo.lastName}`
          : transaction.user.email;

        const metadata = transaction.metadata || {};

        return {
          user: userName,
          points: transaction.amount,
          leftVolume: metadata['Volumen izquierdo'] || 0,
          rightVolume: metadata['Volumen derecho'] || 0,
        };
      });
    } catch (error) {
      this.logger.error(`Error al obtener top earners: ${error.message}`);
      return [];
    }
  }

  // Método para obtener estadísticas semanales
  private async getWeeklyStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalVolume: number;
    leftVolume: number;
    rightVolume: number;
  } | null> {
    try {
      const query = `
        SELECT 
          SUM(wv."leftVolume" + wv."rightVolume") as "totalVolume",
          SUM(wv."leftVolume") as "leftVolume",
          SUM(wv."rightVolume") as "rightVolume"
        FROM weekly_volumes wv
        WHERE wv."weekStartDate" = $1 AND wv."weekEndDate" = $2
      `;

      const result = await this.weeklyVolumeRepository.query(query, [
        startDate,
        endDate,
      ]);

      if (result && result[0]) {
        return {
          totalVolume: parseFloat(result[0].totalVolume) || 0,
          leftVolume: parseFloat(result[0].leftVolume) || 0,
          rightVolume: parseFloat(result[0].rightVolume) || 0,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Error al obtener estadísticas semanales: ${error.message}`,
      );
      return null;
    }
  }

  private async countDirectReferrals(
    userId: string,
  ): Promise<{ directCount: number }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['referralCode'],
      });

      if (!user || !user.referralCode) {
        return { directCount: 0 };
      }

      // Encontrar usuarios que tienen este usuario como referido
      const directReferrals = await this.userRepository.find({
        where: { referrerCode: user.referralCode },
      });

      // Verificar cuántos tienen membresía activa
      let activeCount = 0;
      for (const referral of directReferrals) {
        const activeMembership = await this.membershipRepository.findOne({
          where: {
            user: { id: referral.id },
            status: MembershipStatus.ACTIVE,
          },
        });

        if (activeMembership) {
          activeCount++;
        }
      }

      return { directCount: activeCount };
    } catch (error) {
      this.logger.error(`Error contando referidos directos: ${error.message}`);
      return { directCount: 0 };
    }
  }

  private getLastWeekDates(): { start: Date; end: Date } {
    const today = new Date();
    return {
      start: getFirstDayOfPreviousWeek(today),
      end: getLastDayOfPreviousWeek(today),
    };
  }

  private getCurrentWeekDates(): { start: Date; end: Date } {
    const today = new Date();
    return {
      start: getFirstDayOfWeek(today),
      end: getLastDayOfWeek(today),
    };
  }

  private async checkLeg(
    userId: string,
    side: 'LEFT' | 'RIGHT',
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'referralCode'],
        relations: ['leftChild', 'rightChild'],
      });

      if (!user || !user.referralCode) return false;

      const rootChildId =
        side === 'LEFT' ? user.leftChild?.id : user.rightChild?.id;

      if (!rootChildId) return false;

      const descendantsQuery = `
        WITH RECURSIVE descendants AS (
          -- Nodo inicial
          SELECT id FROM users WHERE id = $1
          
          UNION ALL
          
          -- Unir con todos los descendientes
          SELECT u.id 
          FROM users u
          JOIN descendants d ON 
            u.parent_id = d.id
        )
        SELECT id FROM descendants;
      `;

      const descendants = await this.userRepository.query(descendantsQuery, [
        rootChildId,
      ]);

      if (!descendants || descendants.length === 0) return false;

      const descendantIds = descendants.map((d) => d.id);

      const activeMembershipsQuery = `
        SELECT COUNT(*) as count
        FROM users u
        JOIN memberships m ON m.user_id = u.id
        WHERE u.id = ANY($1) 
          AND u."referrerCode" = $2
          AND m.status = 'ACTIVE';
      `;

      const result = await this.userRepository.query(activeMembershipsQuery, [
        descendantIds,
        user.referralCode,
      ]);

      return parseInt(result[0]?.count || '0') > 0;
    } catch (error) {
      this.logger.error(
        `Error al verificar pierna ${side} para usuario ${userId}: ${error.message}`,
      );
      return false;
    }
  }

  async validarHijos(userId: string, side: 'LEFT' | 'RIGHT') {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'referralCode'],
        relations: ['leftChild', 'rightChild'],
      });

      if (!user || !user.referralCode) return false;

      const rootChildId =
        side === 'LEFT' ? user.leftChild?.id : user.rightChild?.id;

      if (!rootChildId) return false;

      const descendantsQuery = `
        WITH RECURSIVE descendants AS (
          -- Nodo inicial
          SELECT id FROM users WHERE id = $1
          
          UNION ALL
          
          -- Unir con todos los descendientes
          SELECT u.id 
          FROM users u
          JOIN descendants d ON 
            u.parent_id = d.id
        )
        SELECT id FROM descendants;
      `;

      const descendants = await this.userRepository.query(descendantsQuery, [
        rootChildId,
      ]);

      if (!descendants || descendants.length === 0) return false;

      const descendantIds = descendants.map((d) => d.id);

      const activeMembershipsQuery = `
        SELECT COUNT(*) as count
        FROM users u
        JOIN memberships m ON m.user_id = u.id
        WHERE u.id = ANY($1) 
          AND u."referrerCode" = $2
          AND m.status = 'ACTIVE';
      `;

      const result = await this.userRepository.query(activeMembershipsQuery, [
        descendantIds,
        user.referralCode,
      ]);

      return parseInt(result[0]?.count || '0') > 0;
    } catch (error) {
      this.logger.error(
        `Error al verificar pierna ${side} para usuario ${userId}: ${error.message}`,
      );
      return false;
    }
  }

  async cantidadRef(userId: string): Promise<{ directCount: number }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['referralCode'],
      });

      if (!user || !user.referralCode) {
        return { directCount: 0 };
      }

      const directReferrals = await this.userRepository.find({
        where: { referrerCode: user.referralCode },
      });

      let activeCount = 0;
      for (const referral of directReferrals) {
        const activeMembership = await this.membershipRepository.findOne({
          where: {
            user: { id: referral.id },
            status: MembershipStatus.ACTIVE,
          },
        });

        if (activeMembership) {
          activeCount++;
        }
      }

      return { directCount: activeCount };
    } catch (error) {
      this.logger.error(`Error contando referidos directos: ${error.message}`);
      return { directCount: 0 };
    }
  }

  async fixBinaryCommissionPayments(weekEndDateStr: Date): Promise<{
    processed: number;
    successful: number;
    failed: number;
    details: any[];
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const weekEndDate = new Date(weekEndDateStr);
      const binaryTransactions = await this.pointsTransactionRepository.find({
        where: {
          type: PointTransactionType.BINARY_COMMISSION,
          status: PointTransactionStatus.COMPLETED,
          createdAt: Between(
            new Date(weekEndDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            weekEndDate,
          ),
        },
        relations: ['user', 'pointsTransactionsPayments'],
      });

      let processed = 0;
      let successful = 0;
      let failed = 0;
      const details = [];

      for (const transaction of binaryTransactions) {
        try {
          console.log('USER ID:', transaction.user.id);
          console.log('VOLUME WEEK END DATE:', weekEndDate);
          console.log('TRANSACTION ID:', transaction.id);
          console.log('status', VolumeProcessingStatus.PROCESSED);
          const weeklyVolume = await this.weeklyVolumeRepository.findOne({
            where: {
              user: { id: transaction.user.id },
              //la fecha solo debe estar loke 2025-06-01 y tiene que se Date
              weekEndDate: weekEndDateStr,
              status: VolumeProcessingStatus.PROCESSED,
            },
          });

          if (!weeklyVolume) {
            details.push({
              transactionId: transaction.id,
              userId: transaction.user.id,
              status: 'FAILED',
              reason: 'No se encontró volumen semanal procesado',
            });
            failed++;
            processed++;
            continue;
          }

          const volumeHistory = await this.weeklyVolumesHistoryRepository.find({
            where: {
              selectedSide: weeklyVolume.selectedSide,
              weeklyVolumes: { id: weeklyVolume.id },
            },
            relations: ['payment'],
          });

          if (volumeHistory.length === 0) {
            details.push({
              transactionId: transaction.id,
              userId: transaction.user.id,
              status: 'FAILED',
              reason:
                'No se encontró historial de volumen con el lado seleccionado',
            });
            failed++;
            processed++;
            continue;
          }

          const existingPaymentIds = transaction.pointsTransactionsPayments.map(
            (ptp) => ptp.payment.id,
          );

          let associationsCreated = 0;

          for (const history of volumeHistory) {
            if (
              history.payment &&
              !existingPaymentIds.includes(history.payment.id)
            ) {
              const pointsTransactionPayment =
                this.pointsTransactionPaymentRepository.create({
                  pointsTransaction: { id: transaction.id },
                  payment: { id: history.payment.id },
                });

              await queryRunner.manager.save(pointsTransactionPayment);
              associationsCreated++;
            }
          }

          details.push({
            transactionId: transaction.id,
            userId: transaction.user.id,
            status: 'SUCCESS',
            associationsCreated,
            selectedSide: weeklyVolume.selectedSide,
            weeklyVolumeId: weeklyVolume.id,
          });

          successful++;
          processed++;
        } catch (error) {
          this.logger.error(
            `Error procesando transacción ${transaction.id}: ${error.message}`,
          );
          details.push({
            transactionId: transaction.id,
            userId: transaction.user.id,
            status: 'ERROR',
            error: error.message,
          });
          failed++;
          processed++;
        }
      }

      await queryRunner.commitTransaction();

      const result = {
        processed,
        successful,
        failed,
        details,
      };

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error general en corrección: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
