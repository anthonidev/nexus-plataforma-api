import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import {
  MembershipAction,
  MembershipHistory,
} from 'src/memberships/entities/membership_history.entity';
import {
  MembershipUpgrade,
  UpgradeStatus,
} from 'src/memberships/entities/membership_upgrades.entity';
import { NotificationFactory } from 'src/notifications/factory/notification.factory';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { Rank } from 'src/ranks/entities/ranks.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import { getDates } from 'src/utils/dates';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { DirectBonusService } from './direct-bonus.service';
import { TreeVolumeService } from './tree-volumen.service';

@Injectable()
export class PlanUpgradeService {
  private readonly logger = new Logger('PlanUpgradeService');

  constructor(
    @InjectRepository(MembershipUpgrade)
    private readonly membershipUpgradeRepository: Repository<MembershipUpgrade>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(Rank)
    private readonly rankRepository: Repository<Rank>,
    @InjectRepository(UserRank)
    private readonly userRankRepository: Repository<UserRank>,

    private readonly directBonusService: DirectBonusService,
    private readonly treeVolumeService: TreeVolumeService,
    private readonly notificationFactory: NotificationFactory,
  ) {}

  async processPlanUpgradePayment(payment: Payment, queryRunner: any) {
    if (payment.relatedEntityType !== 'membership_upgrade') {
      throw new BadRequestException(
        'El pago no está relacionado a una actualización de plan',
      );
    }

    const membershipUpgrade = await this.membershipUpgradeRepository.findOne({
      where: { id: payment.relatedEntityId },
      relations: [
        'membership',
        'fromPlan',
        'toPlan',
        'membership.user',
        'membership.user.personalInfo',
      ],
    });

    if (!membershipUpgrade) {
      throw new NotFoundException(
        `Actualización con ID ${payment.relatedEntityId} no encontrada`,
      );
    }

    if (membershipUpgrade.status !== UpgradeStatus.PENDING) {
      throw new BadRequestException(
        `La actualización no está en estado pendiente`,
      );
    }

    const user = membershipUpgrade.membership.user;
    const fromPlan = membershipUpgrade.fromPlan;
    const toPlan = membershipUpgrade.toPlan;
    const membership = membershipUpgrade.membership;

    const priceDifference = toPlan.price - fromPlan.price;
    const pointsDifference = toPlan.binaryPoints - fromPlan.binaryPoints;

    if (user.referrerCode) {
      await this.directBonusService.processDirectBonusUpgrade(
        user,
        toPlan,
        fromPlan,
        priceDifference,
        queryRunner,
        payment,
      );
    }

    await this.treeVolumeService.processTreeVolumesUpgrade(
      user,
      pointsDifference,
      queryRunner,
      payment,
    );
    await this.createOrUpdateUserRank(user, toPlan, queryRunner);

    membership.plan = toPlan;

    if (membership.status === MembershipStatus.ACTIVE) {
      // Mantener fechas actuales si ya está activa
    } else {
      const now = new Date();
      const dates = getDates(now);

      membership.status = MembershipStatus.ACTIVE;
      membership.startDate = dates.startDate;
      membership.endDate = dates.endDate;
    }

    await queryRunner.manager.save(membership);

    membershipUpgrade.status = UpgradeStatus.COMPLETED;
    membershipUpgrade.completedDate = new Date();
    await queryRunner.manager.save(membershipUpgrade);

    const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.UPGRADED,
      performedBy: payment.reviewedBy,
      notes: 'Plan actualizado exitosamente',
      changes: {
        'Plan anterior': fromPlan.name,
        'Plan nuevo': toPlan.name,
        'Costo de actualización': priceDifference,
      },
    });

    const userPoints = await this.userPointsRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (userPoints) {
      userPoints.membershipPlan = toPlan;
      await queryRunner.manager.save(userPoints);
    } else {
      const newUserPoints = this.userPointsRepository.create({
        user: { id: user.id },
        membershipPlan: toPlan,
        availablePoints: 0,
        totalEarnedPoints: 0,
        totalWithdrawnPoints: 0,
      });
      await queryRunner.manager.save(newUserPoints);
    }

    await queryRunner.manager.save(membershipHistory);
  }

  private async createOrUpdateUserRank(
    user: User,
    plan: any,
    queryRunner: any,
  ) {
    try {
      const bronzeRank = await this.rankRepository.findOne({
        where: { code: 'BRONZE' },
      });

      if (!bronzeRank) {
        this.logger.warn('No se encontró el rango BRONZE');
        return;
      }

      const existingUserRank = await this.userRankRepository.findOne({
        where: { user: { id: user.id } },
      });

      if (existingUserRank) {
        existingUserRank.membershipPlan = plan;
        await queryRunner.manager.save(existingUserRank);
      } else {
        const newUserRank = this.userRankRepository.create({
          user: { id: user.id },
          membershipPlan: plan,
          currentRank: bronzeRank,
          highestRank: bronzeRank,
        });
        try {
          await this.notificationFactory.rankAchieved(
            user.id,
            bronzeRank.name,
            bronzeRank.code,
          );
        } catch (notificationError) {
          this.logger.error(
            `Error al enviar notificación de aprobación: ${notificationError.message}`,
            notificationError.stack,
          );
        }

        await queryRunner.manager.save(newUserRank);
      }

      this.logger.log(`UserRank creado/actualizado para usuario ${user.id}`);
    } catch (error) {
      this.logger.error(
        `Error al crear/actualizar UserRank: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
