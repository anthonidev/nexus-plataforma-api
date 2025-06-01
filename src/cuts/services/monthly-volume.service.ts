import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import { NotificationFactory } from 'src/notifications/factory/notification.factory';
import {
  MonthlyVolumeRank,
  MonthlyVolumeStatus,
} from 'src/ranks/entities/monthly_volume_ranks.entity';
import { Rank } from 'src/ranks/entities/ranks.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import {
  getFirstDayOfMonth,
  getFirstDayOfPreviousMonth,
  getLastDayOfMonth,
  getLastDayOfPreviousMonth,
} from 'src/utils/dates';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class MonthlyVolumeService {
  private readonly logger = new Logger(MonthlyVolumeService.name);
  private readonly reportRecipients = [
    'softwaretoni21@gmail.com',
    'tonirodriguez110@gmail.com',
  ];
  constructor(
    @InjectRepository(MonthlyVolumeRank)
    private readonly monthlyVolumeRepository: Repository<MonthlyVolumeRank>,
    @InjectRepository(Rank)
    private readonly rankRepository: Repository<Rank>,
    @InjectRepository(UserRank)
    private readonly userRankRepository: Repository<UserRank>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationFactory: NotificationFactory,
    private readonly mailService: MailService,


  ) { }

  async processMonthlyVolumes(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    rankUpdates: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Iniciando procesamiento de volúmenes mensuales');

      const lastMonthDates = this.getLastMonthDates();

      const pendingVolumes = await this.monthlyVolumeRepository.find({
        where: {
          status: MonthlyVolumeStatus.PENDING,
          monthStartDate: lastMonthDates.start,
          monthEndDate: lastMonthDates.end,
        },
        relations: ['user', 'membershipPlan'],
      });

      this.logger.log(
        `Encontrados ${pendingVolumes.length} volúmenes pendientes para procesar`,
      );

      const allRanks = await this.rankRepository.find({
        where: { isActive: true },
        order: { requiredPoints: 'ASC' },
      });

      this.logger.log(`Rangos disponibles: ${allRanks.length}`);

      let processed = 0;
      let successful = 0;
      let failed = 0;
      let rankUpdates = 0;

      const currentMonthDates = this.getCurrentMonthDates();

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
            volume.status = MonthlyVolumeStatus.CANCELLED;
            volume.totalVolume = Number(volume.leftVolume) + Number(volume.rightVolume);
            volume.metadata = {
              Razón: 'Membresía inactiva',
              'Procesado en': new Date().toISOString().split('T')[0],
              'Volumen izquierdo': volume.leftVolume,
              'Volumen derecho': volume.rightVolume,
              'Volumen total': Number(volume.leftVolume) + Number(volume.rightVolume),
            }
            await queryRunner.manager.save(volume);
            const existingNextMonthVolume = await this.monthlyVolumeRepository.findOne({
              where: {
                user: { id: volume.user.id },
                monthStartDate: currentMonthDates.start,
                monthEndDate: currentMonthDates.end,
                status: MonthlyVolumeStatus.PENDING,
              },
            });
            if (existingNextMonthVolume) {
              existingNextMonthVolume.leftVolume = Number(volume.leftVolume) + Number(existingNextMonthVolume.leftVolume);
              existingNextMonthVolume.rightVolume = Number(volume.rightVolume) + Number(existingNextMonthVolume.rightVolume);

              await queryRunner.manager.save(existingNextMonthVolume);
            } else {
              const newVolume = this.monthlyVolumeRepository.create({
                user: { id: volume.user.id },
                membershipPlan: activeMembership.plan,
                leftVolume: 0,
                rightVolume: 0,
                totalVolume: 0,
                leftDirects: 0,
                rightDirects: 0,
                monthStartDate: currentMonthDates.start,
                monthEndDate: currentMonthDates.end,
                status: MonthlyVolumeStatus.PENDING,
              });
              await queryRunner.manager.save(newVolume);
            }
            processed++;
            failed++;
            continue;
          }
          const hasLeftLeg = await this.checkLeg(volume.user.id, 'LEFT');
          const hasRightLeg = await this.checkLeg(volume.user.id, 'RIGHT');
          volume.leftDirects = hasLeftLeg.count;
          volume.rightDirects = hasRightLeg.count;
          await queryRunner.manager.save(volume);
          if (!hasLeftLeg.hasActive || !hasRightLeg.hasActive) {
            this.logger.warn(
              `Usuario ${volume.user.id} no tiene referidos activos en una de las piernas`,
            );
            volume.status = MonthlyVolumeStatus.CANCELLED;
            volume.totalVolume = Number(volume.leftVolume) + Number(volume.rightVolume);
            volume.metadata = {
              Razón: 'No tiene referidos activos en una de las piernas',
              'Procesado en': new Date().toISOString().split('T')[0],
              'Volumen izquierdo': volume.leftVolume,
              'Volumen derecho': volume.rightVolume,
              'Volumen total': Number(volume.leftVolume) + Number(volume.rightVolume),
              'Referidos izquierdos': hasLeftLeg.count,
              'Referidos derechos': hasRightLeg.count,
            }
            const lowestRank = allRanks[0];
            volume.assignedRank = lowestRank;
            await queryRunner.manager.save(volume);
            const existingNextMonthVolume = await this.monthlyVolumeRepository.findOne({
              where: {
                user: { id: volume.user.id },
                monthStartDate: currentMonthDates.start,
                monthEndDate: currentMonthDates.end,
                status: MonthlyVolumeStatus.PENDING,
              },
            });
            if (existingNextMonthVolume) {
              existingNextMonthVolume.leftVolume = Number(volume.leftVolume) + Number(existingNextMonthVolume.leftVolume);
              existingNextMonthVolume.rightVolume = Number(volume.rightVolume) + Number(existingNextMonthVolume.rightVolume);

              await queryRunner.manager.save(existingNextMonthVolume);
            }
            else {
              const newVolume = this.monthlyVolumeRepository.create({
                user: { id: volume.user.id },
                membershipPlan: activeMembership.plan,
                leftVolume: 0,
                rightVolume: 0,
                totalVolume: 0,
                leftDirects: 0,
                rightDirects: 0,
                monthStartDate: currentMonthDates.start,
                monthEndDate: currentMonthDates.end,
                status: MonthlyVolumeStatus.PENDING,
              });
              await queryRunner.manager.save(newVolume);
            }

            await this.updateUserRank(
              volume.user.id,
              lowestRank,
              activeMembership.plan,
              queryRunner,
            );

            processed++;
            failed++;
            continue;
          }

          let assignedRank = allRanks[0];
          const totalDirects = hasRightLeg.count + hasLeftLeg.count;
          const totalVolume = Number(volume.leftVolume) + Number(volume.rightVolume);
          for (let i = allRanks.length - 1; i >= 0; i--) {
            const rank = allRanks[i];

            if (
              totalVolume >= rank.requiredPoints &&
              totalDirects >= rank.requiredDirects
            ) {
              assignedRank = rank;
              break;
            }
          }
          volume.assignedRank = assignedRank;
          volume.status = MonthlyVolumeStatus.PROCESSED;
          volume.totalVolume = Number(volume.leftVolume) + Number(volume.rightVolume);
          volume.metadata = {
            'Rango asignado': assignedRank.name,
            'Procesado en': new Date().toISOString().split('T')[0],
            'Volumen izquierdo': volume.leftVolume,
            'Volumen derecho': volume.rightVolume,
            'Volumen total': Number(volume.leftVolume) + Number(volume.rightVolume),
            'Referidos izquierdos': hasLeftLeg.count,
            'Referidos derechos': hasRightLeg.count,
          };
          try {
            await this.notificationFactory.rankAchieved(
              volume.user.id,
              assignedRank.name,
              assignedRank.code,
            )
          } catch (notificationError) {
            this.logger.error(
              `Error al enviar notificación de aprobación: ${notificationError.message}`,
              notificationError.stack,
            );
          }
          await queryRunner.manager.save(volume);

          const rankUpdated = await this.updateUserRank(
            volume.user.id,
            assignedRank,
            activeMembership.plan,
            queryRunner,
          );
          if (rankUpdated) {
            rankUpdates++;
          }

          const existingNextMonthVolume = await this.monthlyVolumeRepository.findOne({
            where: {
              user: { id: volume.user.id },
              monthStartDate: currentMonthDates.start,
              monthEndDate: currentMonthDates.end,
              status: MonthlyVolumeStatus.PENDING,
            },
          });
          if (existingNextMonthVolume) {
            existingNextMonthVolume.leftVolume = Number(volume.leftVolume) + Number(existingNextMonthVolume.leftVolume);
            existingNextMonthVolume.rightVolume = Number(volume.rightVolume) + Number(existingNextMonthVolume.rightVolume);

            await queryRunner.manager.save(existingNextMonthVolume);
          }
          else {
            const newVolume = this.monthlyVolumeRepository.create({
              user: { id: volume.user.id },
              membershipPlan: activeMembership.plan,
              leftVolume: 0,
              rightVolume: 0,
              totalVolume: 0,
              leftDirects: 0,
              rightDirects: 0,
              monthStartDate: currentMonthDates.start,
              monthEndDate: currentMonthDates.end,
              status: MonthlyVolumeStatus.PENDING,
            });
            await queryRunner.manager.save(newVolume);
          }

          processed++;
          successful++;
        } catch (error) {
          this.logger.error(
            `Error procesando volumen mensual ${volume.id}: ${error.message}`,
          );
          failed++;
        }

      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Procesamiento de volúmenes mensuales completado. Procesados: ${processed}, Exitosos: ${successful}, Fallidos: ${failed}, Actualizaciones de rango: ${rankUpdates}`,
      );
      await this.sendMonthlyVolumeReport({
        processed,
        successful,
        failed,
        rankUpdates,
        monthStartDate: lastMonthDates.start,
        monthEndDate: lastMonthDates.end,
      });
      return {
        processed,
        successful,
        failed,
        rankUpdates,
      };
    } catch (error) {
      this.logger.error(
        `Error general en procesamiento de volúmenes mensuales: ${error.message}`,
      );
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async updateUserRank(
    userId: string,
    newRank: Rank,
    membershipPlan: any,
    queryRunner: any,
  ): Promise<boolean> {
    try {
      let userRank = await this.userRankRepository.findOne({
        where: { user: { id: userId } },
        relations: ['currentRank', 'highestRank'],
      });

      if (!userRank) {
        userRank = this.userRankRepository.create({
          user: { id: userId },
          membershipPlan: membershipPlan,
          currentRank: newRank,
          highestRank: newRank,
        });

        await queryRunner.manager.save(userRank);
        return true;
      }

      let rankChanged = false;

      if (!userRank.currentRank || userRank.currentRank.id !== newRank.id) {
        userRank.currentRank = newRank;
        rankChanged = true;
      }

      if (
        !userRank.highestRank ||
        newRank.requiredPoints > userRank.highestRank.requiredPoints
      ) {
        userRank.highestRank = newRank;
      }

      userRank.membershipPlan = membershipPlan;

      await queryRunner.manager.save(userRank);
      return rankChanged;
    } catch (error) {
      this.logger.error(
        `Error al actualizar rango de usuario ${userId}: ${error.message}`,
      );
      return false;
    }
  }
  private async checkLeg(
    userId: string,
    side: 'LEFT' | 'RIGHT',
  ): Promise<
    { count: number; hasActive: boolean }
  > {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'referralCode'],
        relations: ['leftChild', 'rightChild'],
      });

      if (!user || !user.referralCode) return {
        count: 0,
        hasActive: false,
      }

      const rootChildId =
        side === 'LEFT' ? user.leftChild?.id : user.rightChild?.id;

      if (!rootChildId) return {
        count: 0,
        hasActive: false,
      }

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

      if (!descendants || descendants.length === 0) return {
        count: 0,
        hasActive: false,
      }

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

      return {
        count: parseInt(result[0]?.count || '0'),
        hasActive: parseInt(result[0]?.count || '0') > 0,
      }
    } catch (error) {
      this.logger.error(
        `Error al verificar pierna ${side} para usuario ${userId}: ${error.message}`,
      );
      return {
        count: 0,
        hasActive: false,
      }
    }
  }



  private getLastMonthDates(): { start: Date; end: Date } {
    const today = new Date();
    return {
      start: getFirstDayOfPreviousMonth(today),
      end: getLastDayOfPreviousMonth(today),
    };
  }

  private getCurrentMonthDates(): { start: Date; end: Date } {
    const today = new Date();

    return {
      start: getFirstDayOfMonth(today),
      end: getLastDayOfMonth(today),
    };
  }

  private async sendMonthlyVolumeReport(reportData: {
    processed: number;
    successful: number;
    failed: number;
    rankUpdates: number;
    monthStartDate: Date;
    monthEndDate: Date;
  }): Promise<void> {
    try {
      const formattedStartDate = reportData.monthStartDate
        .toISOString()
        .split('T')[0];
      const formattedEndDate = reportData.monthEndDate
        .toISOString()
        .split('T')[0];

      // Obtener información adicional
      const topPerformers = await this.getTopMonthlyEarners(
        reportData.monthStartDate,
        reportData.monthEndDate,
        5
      );

      const monthlyStats = await this.getMonthlyStats(
        reportData.monthStartDate,
        reportData.monthEndDate
      );

      const subject = `Reporte de Volúmenes Mensuales: ${formattedStartDate} al ${formattedEndDate}`;

      const successRate = reportData.processed > 0
        ? ((reportData.successful / reportData.processed) * 100).toFixed(2)
        : 0;

      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reporte Mensual de Volúmenes</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; margin-bottom: 20px;">
            <tr>
              <td style="padding: 20px;">
                <h1 style="color: #0a8043; margin: 0; padding: 0; font-size: 24px;">Reporte de Volúmenes Mensuales</h1>
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
                      <p style="font-size: 28px; font-weight: bold; margin: 0; color: #0a8043;">${reportData.successful}</p>
                      <p style="font-size: 14px; margin: 5px 0 0 0; color: #666;">Usuarios procesados</p>
                    </td>
                    <td width="50%" style="background-color: #f8f9fa; border-radius: 4px; padding: 15px;">
                      <p style="font-size: 28px; font-weight: bold; margin: 0; color: #0a8043;">${reportData.rankUpdates}</p>
                      <p style="font-size: 14px; margin: 5px 0 0 0; color: #666;">Actualizaciones de rango</p>
                    </td>
                  </tr>
                </table>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                  <tr>
                    <td width="33%" style="padding: 0 10px 0 0;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${successRate}%</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Tasa de éxito</p>
                      </div>
                    </td>
                    <td width="33%" style="padding: 0 10px;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${reportData.failed}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Procesos fallidos</p>
                      </div>
                    </td>
                    <td width="33%" style="padding: 0 0 0 10px;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${monthlyStats?.totalUsers || 0}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Usuarios totales</p>
                      </div>
                    </td>
                  </tr>
                </table>
  
                ${monthlyStats ? `
                <h2 style="color: #0a8043; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Métricas Mensuales
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                  <tr>
                    <td width="25%" style="padding: 0 10px 0 0;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${monthlyStats.totalVolume.toFixed(2)}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Volumen total</p>
                      </div>
                    </td>
                    <td width="25%" style="padding: 0 10px;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${monthlyStats.leftVolume.toFixed(2)}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Volumen izquierdo</p>
                      </div>
                    </td>
                    <td width="25%" style="padding: 0 10px;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${monthlyStats.rightVolume.toFixed(2)}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Volumen derecho</p>
                      </div>
                    </td>
                    <td width="25%" style="padding: 0 0 0 10px;">
                      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 18px; font-weight: bold; margin: 0; color: #0a8043;">${monthlyStats.avgVolume.toFixed(2)}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">Promedio por usuario</p>
                      </div>
                    </td>
                  </tr>
                </table>
                ` : ''}
  
                ${topPerformers.length > 0 ? `
                <h2 style="color: #0a8043; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Top ${topPerformers.length} Performers
                </h2>
                <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                  <tr style="background-color: #effaf5; font-weight: bold;">
                    <th style="text-align: left; padding: 10px; border-bottom: 1px solid #dee2e6;">Usuario</th>
                    <th style="text-align: right; padding: 10px; border-bottom: 1px solid #dee2e6;">Volumen Total</th>
                    <th style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">Rango</th>
                    <th style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">Directos</th>
                  </tr>
                  ${topPerformers.map((performer, index) => `
                  <tr style="background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'};">
                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${performer.user}</td>
                    <td style="text-align: right; padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: bold;">${performer.totalVolume.toFixed(2)}</td>
                    <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">${performer.rank}</td>
                    <td style="text-align: center; padding: 10px; border-bottom: 1px solid #dee2e6;">${performer.totalDirects}</td>
                  </tr>
                  `).join('')}
                </table>
                ` : ''}
                
                <h2 style="color: #0a8043; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Detalles del Procesamiento
                </h2>
                <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
                  <tr style="background-color: #effaf5; font-weight: bold;">
                    <th style="text-align: left; padding: 10px; border: 1px solid #dee2e6;">Métrica</th>
                    <th style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">Valor</th>
                  </tr>
                  <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Volúmenes procesados</td>
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
                    <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Actualizaciones de rango</strong></td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;"><strong>${reportData.rankUpdates}</strong></td>
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
        `Reporte de volúmenes mensuales enviado a: ${this.reportRecipients.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(`Error al enviar reporte mensual: ${error.message}`);
    }
  }

  // Obtener top performers del mes
  private async getTopMonthlyEarners(
    startDate: Date,
    endDate: Date,
    limit: number = 5
  ): Promise<Array<{ user: string; totalVolume: number; rank: string; totalDirects: number }>> {
    try {
      const volumes = await this.monthlyVolumeRepository.find({
        where: {
          monthStartDate: startDate,
          monthEndDate: endDate,
          status: MonthlyVolumeStatus.PROCESSED
        },
        relations: ['user', 'assignedRank', 'user.personalInfo'],
        order: { totalVolume: 'DESC' },
        take: limit,
      });

      return volumes.map(volume => ({
        user: volume.user.personalInfo
          ? `${volume.user.personalInfo.firstName} ${volume.user.personalInfo.lastName}`
          : volume.user.email,
        totalVolume: volume.totalVolume,
        rank: volume.assignedRank?.name || 'Sin rango',
        totalDirects: (volume.leftDirects || 0) + (volume.rightDirects || 0)
      }));
    } catch (error) {
      this.logger.error(`Error obteniendo top performers: ${error.message}`);
      return [];
    }
  }

  // Obtener estadísticas mensuales
  private async getMonthlyStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalVolume: number;
    leftVolume: number;
    rightVolume: number;
    avgVolume: number;
    totalUsers: number;
  } | null> {
    try {
      const result = await this.monthlyVolumeRepository
        .createQueryBuilder('volume')
        .select('SUM(volume.totalVolume)', 'totalVolume')
        .addSelect('SUM(volume.leftVolume)', 'leftVolume')
        .addSelect('SUM(volume.rightVolume)', 'rightVolume')
        .addSelect('COUNT(volume.id)', 'totalUsers')
        .where('volume.monthStartDate = :startDate AND volume.monthEndDate = :endDate', {
          startDate,
          endDate
        })
        .getRawOne();

      if (!result) return null;

      const totalVolume = parseFloat(result.totalVolume) || 0;
      const totalUsers = parseInt(result.totalUsers) || 0;

      return {
        totalVolume,
        leftVolume: parseFloat(result.leftVolume) || 0,
        rightVolume: parseFloat(result.rightVolume) || 0,
        avgVolume: totalUsers > 0 ? totalVolume / totalUsers : 0,
        totalUsers
      };
    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas mensuales: ${error.message}`);
      return null;
    }
  }
}
