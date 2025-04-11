import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class WeeklyVolumeService {
  private readonly logger = new Logger(WeeklyVolumeService.name);

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

      // 1. Obtener la fecha de inicio y fin de la semana pasada
      const lastWeekDates = this.getLastWeekDates();

      // Obtener todos los volúmenes pendientes de la semana pasada
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

      // Obtener las fechas para el nuevo periodo (semana actual)
      const currentWeekDates = this.getCurrentWeekDates();

      // Procesar cada volumen
      for (const volume of pendingVolumes) {
        try {
          // Verificar si el usuario tiene un plan activo
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
            volume.status = VolumeProcessingStatus.PROCESSED;
            await queryRunner.manager.save(volume);
            processed++;
            failed++;
            continue;
          }

          // Verificar si el usuario tiene hijos en ambos lados (no necesariamente directos)
          const hasLeftLeg = await this.checkLeg(volume.user.id, 'LEFT');
          const hasRightLeg = await this.checkLeg(volume.user.id, 'RIGHT');

          if (!hasLeftLeg || !hasRightLeg) {
            this.logger.warn(
              `Usuario ${volume.user.id} no tiene hijos en ambos lados`,
            );
            volume.status = VolumeProcessingStatus.PROCESSED;
            await queryRunner.manager.save(volume);
            processed++;
            failed++;
            continue;
          }

          // 2. Determinar el lado con mayor volumen
          let selectedSide: VolumeSide;
          if (volume.leftVolume >= volume.rightVolume) {
            selectedSide = VolumeSide.LEFT;
          } else {
            selectedSide = VolumeSide.RIGHT;
          }
          volume.selectedSide = selectedSide;

          // Calcular puntos a asignar
          const commissionPercentage =
            activeMembership.plan.commissionPercentage / 100;
          const higherVolume =
            selectedSide === VolumeSide.LEFT
              ? volume.leftVolume
              : volume.rightVolume;
          const lowerVolume =
            selectedSide === VolumeSide.LEFT
              ? volume.rightVolume
              : volume.leftVolume;

          // Puntos comisionables (se calcula sobre el volumen menor)
          const pointsToAdd = lowerVolume * commissionPercentage;

          // 3. Actualizar el estado del volumen
          volume.status = VolumeProcessingStatus.PROCESSED;

          // 4. Actualizar los puntos del usuario
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

          // 5. Crear una transacción de puntos
          const pointsTransaction = this.pointsTransactionRepository.create({
            user: { id: volume.user.id },
            membershipPlan: activeMembership.plan,
            amount: pointsToAdd,
            type: PointTransactionType.BINARY_COMMISSION,
            status: PointTransactionStatus.COMPLETED,
            metadata: {
              weeklyVolumeId: volume.id,
              weekStartDate: volume.weekStartDate,
              weekEndDate: volume.weekEndDate,
              leftVolume: volume.leftVolume,
              rightVolume: volume.rightVolume,
              selectedSide: volume.selectedSide,
              commissionPercentage: activeMembership.plan.commissionPercentage,
            },
          });

          await queryRunner.manager.save(pointsTransaction);

          // 6 y 7. Crear un nuevo volumen para la semana actual con el volumen restante
          const newVolume = this.weeklyVolumeRepository.create({
            user: { id: volume.user.id },
            membershipPlan: activeMembership.plan,
            leftVolume: selectedSide === VolumeSide.LEFT ? 0 : lowerVolume,
            rightVolume: selectedSide === VolumeSide.RIGHT ? 0 : lowerVolume,
            weekStartDate: currentWeekDates.start,
            weekEndDate: currentWeekDates.end,
            status: VolumeProcessingStatus.PENDING,
            carryOverVolume: lowerVolume,
          });

          await queryRunner.manager.save(newVolume);

          // Guardar el volumen procesado
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

  // Métodos auxiliares

  private getLastWeekDates(): { start: Date; end: Date } {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = domingo, 1 = lunes, etc.

    // Calcular fecha de inicio (lunes) de la semana pasada
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - currentDay - 6); // Retroceder al lunes de la semana pasada
    lastMonday.setHours(0, 0, 0, 0);

    // Calcular fecha de fin (domingo) de la semana pasada
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    return {
      start: lastMonday,
      end: lastSunday,
    };
  }

  private getCurrentWeekDates(): { start: Date; end: Date } {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = domingo, 1 = lunes, etc.

    // Calcular fecha de inicio (lunes) de la semana actual
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setHours(0, 0, 0, 0);

    // Calcular fecha de fin (domingo) de la semana actual
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: monday,
      end: sunday,
    };
  }

  private async checkLeg(
    userId: string,
    side: 'LEFT' | 'RIGHT',
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [side === 'LEFT' ? 'leftChild' : 'rightChild'],
    });

    if (!user) return false;

    const child = side === 'LEFT' ? user.leftChild : user.rightChild;

    if (!child) return false;

    // Verificar si el hijo tiene membresía activa
    const activeMembership = await this.membershipRepository.findOne({
      where: {
        user: { id: child.id },
        status: MembershipStatus.ACTIVE,
      },
    });

    return !!activeMembership;
  }
}
