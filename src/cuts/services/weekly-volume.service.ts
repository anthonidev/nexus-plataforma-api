import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import {
  PointsTransaction,
  PointTransactionStatus,
  PointTransactionType,
} from 'src/points/entities/points_transactions.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
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
import { DataSource, Repository } from 'typeorm';

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
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
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

            // Calcular el volumen a trasladar igual que en el caso normal: el diferencial que queda después de comparar lados
            let higherSide: VolumeSide;
            let lowerSide: VolumeSide;
            let carryOverVolume = 0;

            if (volume.leftVolume >= volume.rightVolume) {
              higherSide = VolumeSide.LEFT;
              lowerSide = VolumeSide.RIGHT;
              carryOverVolume = Math.max(
                0,
                volume.leftVolume - volume.rightVolume,
              );
            } else {
              higherSide = VolumeSide.RIGHT;
              lowerSide = VolumeSide.LEFT;
              carryOverVolume = Math.max(
                0,
                volume.rightVolume - volume.leftVolume,
              );
            }

            // Verificar si ya existe un volumen para la siguiente semana
            const existingNextWeekVolume =
              await this.weeklyVolumeRepository.findOne({
                where: {
                  user: { id: volume.user.id },
                  weekStartDate: currentWeekDates.start,
                  weekEndDate: currentWeekDates.end,
                },
              });

            if (existingNextWeekVolume) {
              // Si ya existe, actualizar sumando el volumen trasladado al lado correspondiente
              if (higherSide === VolumeSide.LEFT) {
                existingNextWeekVolume.leftVolume =
                  Number(existingNextWeekVolume.leftVolume) + carryOverVolume;
              } else {
                existingNextWeekVolume.rightVolume =
                  Number(existingNextWeekVolume.rightVolume) + carryOverVolume;
              }

              existingNextWeekVolume.carryOverVolume =
                Number(existingNextWeekVolume.carryOverVolume) +
                carryOverVolume;

              await queryRunner.manager.save(existingNextWeekVolume);
            } else {
              // Si no existe, crear uno nuevo
              const newVolume = this.weeklyVolumeRepository.create({
                user: { id: volume.user.id },
                membershipPlan: activeMembership.plan,
                leftVolume:
                  higherSide === VolumeSide.LEFT ? carryOverVolume : 0,
                rightVolume:
                  higherSide === VolumeSide.RIGHT ? carryOverVolume : 0,
                weekStartDate: currentWeekDates.start,
                weekEndDate: currentWeekDates.end,
                status: VolumeProcessingStatus.PENDING,
                carryOverVolume: carryOverVolume,
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

          if (directCount >= 2 && lowerVolume > 12500) {
            effectiveLowerVolume = 12500;
          } else if (directCount >= 3 && lowerVolume > 50000) {
            effectiveLowerVolume = 50000;
          } else if (directCount >= 4 && lowerVolume > 150000) {
            effectiveLowerVolume = 150000;
          } else if (directCount >= 5 && lowerVolume > 250000) {
            effectiveLowerVolume = 250000;
          } else {
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

          await queryRunner.manager.save(pointsTransaction);

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

      const subject = `Reporte de Procesamiento de Volúmenes Semanales: ${formattedStartDate} al ${formattedEndDate}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h1 style="color: #0066cc; border-bottom: 1px solid #eee; padding-bottom: 10px;">Reporte de Procesamiento de Volúmenes Semanales</h1>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Período:</strong> ${formattedStartDate} al ${formattedEndDate}</p>
            <p><strong>Fecha de ejecución:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <h2 style="color: #333;">Resumen de Procesamiento</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Métrica</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Valor</th>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Volúmenes Procesados</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${reportData.processed}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Procesamiento Exitoso</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${reportData.successful}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Procesamientos Fallidos</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${reportData.failed}</td>
            </tr>
            <tr style="background-color: #e6f7ff;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total de Puntos Distribuidos</strong></td>
              <td style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>${reportData.totalPoints.toFixed(2)}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Tasa de Éxito</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${reportData.processed > 0 ? ((reportData.successful / reportData.processed) * 100).toFixed(2) : 0}%</td>
            </tr>
          </table>
          
          <p style="color: #666; font-style: italic; margin-top: 30px;">Este es un correo automático generado por el sistema de procesamiento de volúmenes de Nexus Platform. Por favor no responda a este correo.</p>
        </div>
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
}
