import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import {
  MonthlyVolumeRank,
  MonthlyVolumeStatus,
} from 'src/ranks/entities/monthly_volume_ranks.entity';
import { Rank } from 'src/ranks/entities/ranks.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class MonthlyVolumeService {
  private readonly logger = new Logger(MonthlyVolumeService.name);

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
  ) {}

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

      // 1. Obtener la fecha de inicio y fin del mes pasado
      const lastMonthDates = this.getLastMonthDates();

      // Obtener todos los volúmenes pendientes del mes pasado
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

      // Obtener todos los rangos disponibles, ordenados por puntos requeridos (ascendente)
      const allRanks = await this.rankRepository.find({
        where: { isActive: true },
        order: { requiredPoints: 'ASC' },
      });

      this.logger.log(`Rangos disponibles: ${allRanks.length}`);

      let processed = 0;
      let successful = 0;
      let failed = 0;
      let rankUpdates = 0;

      // Obtener las fechas para el nuevo periodo (mes actual)
      const currentMonthDates = this.getCurrentMonthDates();

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
            volume.status = MonthlyVolumeStatus.PROCESSED;
            await queryRunner.manager.save(volume);
            processed++;
            failed++;
            continue;
          }

          // 2. Sumar volúmenes y asignar a totalVolume
          // Nota: esto ya está en el campo totalVolume, pero aseguramos que sea correcto
          volume.totalVolume =
            Number(volume.leftVolume) + Number(volume.rightVolume);

          // 3. Contar usuarios directos activos
          const referralCode = await this.userRepository.findOne({
            where: { id: volume.user.id },
            select: ['referralCode'],
          });

          if (!referralCode) {
            this.logger.warn(
              `No se encontró código de referido para usuario ${volume.user.id}`,
            );
            volume.status = MonthlyVolumeStatus.PROCESSED;
            await queryRunner.manager.save(volume);
            processed++;
            failed++;
            continue;
          }

          const directsWithPosition = await this.findDirectReferrals(
            referralCode.referralCode,
          );

          let leftDirects = 0;
          let rightDirects = 0;

          for (const direct of directsWithPosition) {
            // Verificar si el directo tiene membresía activa
            const directMembership = await this.membershipRepository.findOne({
              where: {
                user: { id: direct.id },
                status: MembershipStatus.ACTIVE,
              },
            });

            if (directMembership) {
              if (direct.position === 'LEFT') {
                leftDirects++;
              } else if (direct.position === 'RIGHT') {
                rightDirects++;
              }
            }
          }

          // Actualizar directos en el volumen
          volume.leftDirects = leftDirects;
          volume.rightDirects = rightDirects;
          const totalDirects = leftDirects + rightDirects;

          // 5. Validar que tenga al menos un directo activo en cada lado
          if (leftDirects < 1 || rightDirects < 1) {
            this.logger.warn(
              `Usuario ${volume.user.id} no tiene al menos un directo activo en cada lado`,
            );
            // Asignar el rango más bajo (normalmente BRONZE)
            const lowestRank = allRanks[0];
            volume.assignedRank = lowestRank;
            volume.status = MonthlyVolumeStatus.PROCESSED;
            await queryRunner.manager.save(volume);

            // Actualizar UserRank
            await this.updateUserRank(
              volume.user.id,
              lowestRank,
              activeMembership.plan,
              queryRunner,
            );

            // Crear nuevo volumen para el mes actual
            await this.createNewMonthlyVolume(
              volume.user.id,
              activeMembership.plan,
              currentMonthDates,
              queryRunner,
            );

            processed++;
            successful++;
            continue;
          }

          // 4. Determinar qué rango corresponde
          let assignedRank = allRanks[0]; // Por defecto, el rango más bajo

          // Recorrer los rangos de mayor a menor para encontrar el adecuado
          for (let i = allRanks.length - 1; i >= 0; i--) {
            const rank = allRanks[i];

            if (
              volume.totalVolume >= rank.requiredPoints &&
              totalDirects >= rank.requiredDirects
            ) {
              assignedRank = rank;
              break;
            }
          }

          // 6. Asignar rango y actualizar estado
          volume.assignedRank = assignedRank;
          volume.status = MonthlyVolumeStatus.PROCESSED;
          await queryRunner.manager.save(volume);

          // 7. Actualizar UserRank
          const rankUpdated = await this.updateUserRank(
            volume.user.id,
            assignedRank,
            activeMembership.plan,
            queryRunner,
          );

          if (rankUpdated) {
            rankUpdates++;
          }

          // 10. Crear nuevo volumen para el mes actual
          await this.createNewMonthlyVolume(
            volume.user.id,
            activeMembership.plan,
            currentMonthDates,
            queryRunner,
          );

          successful++;
        } catch (error) {
          this.logger.error(
            `Error procesando volumen mensual ${volume.id}: ${error.message}`,
          );
          failed++;
        }

        processed++;
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Procesamiento de volúmenes mensuales completado. Procesados: ${processed}, Exitosos: ${successful}, Fallidos: ${failed}, Actualizaciones de rango: ${rankUpdates}`,
      );

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

  // Métodos auxiliares

  private async findDirectReferrals(
    referralCode: string,
  ): Promise<Array<{ id: string; position: string }>> {
    try {
      const referrals = await this.userRepository.find({
        where: { referrerCode: referralCode },
        select: ['id', 'position'],
      });

      return referrals.map((user) => ({
        id: user.id,
        position: user.position,
      }));
    } catch (error) {
      this.logger.error(`Error al buscar referidos directos: ${error.message}`);
      return [];
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
        // Crear nuevo UserRank si no existe
        userRank = this.userRankRepository.create({
          user: { id: userId },
          membershipPlan: membershipPlan,
          currentRank: newRank,
          highestRank: newRank,
        });

        await queryRunner.manager.save(userRank);
        return true;
      }

      // Actualizar el rango actual
      let rankChanged = false;

      if (!userRank.currentRank || userRank.currentRank.id !== newRank.id) {
        userRank.currentRank = newRank;
        rankChanged = true;
      }

      // Actualizar el rango histórico más alto si corresponde
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

  private async createNewMonthlyVolume(
    userId: string,
    membershipPlan: any,
    dates: { start: Date; end: Date },
    queryRunner: any,
  ): Promise<void> {
    try {
      const newVolume = this.monthlyVolumeRepository.create({
        user: { id: userId },
        membershipPlan: membershipPlan,
        leftVolume: 0,
        rightVolume: 0,
        totalVolume: 0,
        leftDirects: 0,
        rightDirects: 0,
        monthStartDate: dates.start,
        monthEndDate: dates.end,
        status: MonthlyVolumeStatus.PENDING,
      });

      await queryRunner.manager.save(newVolume);
    } catch (error) {
      this.logger.error(
        `Error al crear nuevo volumen mensual para usuario ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  private getLastMonthDates(): { start: Date; end: Date } {
    const today = new Date();

    // Primer día del mes pasado
    const firstDayLastMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    );
    firstDayLastMonth.setHours(0, 0, 0, 0);

    // Último día del mes pasado
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    lastDayLastMonth.setHours(23, 59, 59, 999);

    return {
      start: firstDayLastMonth,
      end: lastDayLastMonth,
    };
  }

  private getCurrentMonthDates(): { start: Date; end: Date } {
    const today = new Date();

    // Primer día del mes actual
    const firstDayCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
    firstDayCurrentMonth.setHours(0, 0, 0, 0);

    // Último día del mes actual
    const lastDayCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );
    lastDayCurrentMonth.setHours(23, 59, 59, 999);

    return {
      start: firstDayCurrentMonth,
      end: lastDayCurrentMonth,
    };
  }
}
