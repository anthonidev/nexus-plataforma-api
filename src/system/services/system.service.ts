import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import * as bcrypt from 'bcryptjs';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import {
  MembershipAction,
  MembershipHistory,
} from 'src/memberships/entities/membership_history.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { Rank } from 'src/ranks/entities/ranks.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import { getDates } from 'src/utils/dates';
import { DataSource, Repository } from 'typeorm';
import { UpdatePasswordDto } from '../dto/update-password.dto';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly SALT_ROUNDS = 10;
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MembershipPlan)
    private readonly membershipPlanRepository: Repository<MembershipPlan>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(Rank)
    private readonly rankRepository: Repository<Rank>,
    @InjectRepository(UserRank)
    private readonly userRankRepository: Repository<UserRank>,
    private readonly dataSource: DataSource,
  ) {}

  async activateUserWithPlan(email: string, planCode: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await this.userRepository.findOne({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con email ${email} no encontrado`);
      }

      const existingActiveMembership = await this.membershipRepository.findOne({
        where: {
          user: { id: user.id },
          status: MembershipStatus.ACTIVE,
        },
      });

      if (existingActiveMembership) {
        throw new BadRequestException(
          `El usuario ${email} ya tiene una membresía activa`,
        );
      }

      const planName = this.getPlanNameByCode(planCode);
      const plan = await this.membershipPlanRepository.findOne({
        where: { name: planName },
      });

      if (!plan) {
        throw new NotFoundException(
          `Plan con código ${planCode} no encontrado`,
        );
      }

      const now = new Date();
      const dates = getDates(now);

      const membership = this.membershipRepository.create({
        user: { id: user.id },
        plan: { id: plan.id },
        startDate: dates.startDate,
        endDate: dates.endDate,
        status: MembershipStatus.ACTIVE,
        paidAmount: plan.price,
        paymentReference: 'Activación Directa',
        autoRenewal: false,
        minimumReconsumptionAmount: 300,
      });

      const savedMembership = await queryRunner.manager.save(membership);

      let userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: user.id } },
      });

      if (userPoints) {
        userPoints.membershipPlan = plan;
        await queryRunner.manager.save(userPoints);
      } else {
        const newUserPoints = this.userPointsRepository.create({
          user: { id: user.id },
          membershipPlan: plan,
          availablePoints: 0,
          totalEarnedPoints: 0,
          totalWithdrawnPoints: 0,
        });
        await queryRunner.manager.save(newUserPoints);
      }

      const bronzeRank = await this.rankRepository.findOne({
        where: { code: 'BRONZE' },
      });

      if (!bronzeRank) {
        throw new Error('Rango BRONZE no encontrado');
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
        await queryRunner.manager.save(newUserRank);
      }

      const membershipHistory = this.membershipHistoryRepository.create({
        membership: { id: savedMembership.id },
        action: MembershipAction.CREATED,
        notes: 'Membresía activada directamente por administrador',
        metadata: {
          planId: plan.id,
          planName: plan.name,
          directActivation: true,
        },
      });

      await queryRunner.manager.save(membershipHistory);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Membresía activada exitosamente para el usuario ${email} con el plan ${plan.name}`,
        data: {
          userId: user.id,
          email: user.email,
          plan: {
            id: plan.id,
            name: plan.name,
            price: plan.price,
          },
          membership: {
            id: savedMembership.id,
            startDate: savedMembership.startDate,
            endDate: savedMembership.endDate,
          },
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error en activación directa: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async changeUserPlan(email: string, planCode: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await this.userRepository.findOne({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con email ${email} no encontrado`);
      }

      const existingMembership = await this.membershipRepository.findOne({
        where: {
          user: { id: user.id },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      if (!existingMembership) {
        throw new BadRequestException(
          `El usuario ${email} no tiene una membresía activa`,
        );
      }

      const planName = this.getPlanNameByCode(planCode);
      const newPlan = await this.membershipPlanRepository.findOne({
        where: { name: planName },
      });

      if (!newPlan) {
        throw new NotFoundException(
          `Plan con código ${planCode} no encontrado`,
        );
      }

      if (existingMembership.plan.id === newPlan.id) {
        throw new BadRequestException(
          `El usuario ya tiene el plan ${newPlan.name}`,
        );
      }

      const previousPlan = {
        id: existingMembership.plan.id,
        name: existingMembership.plan.name,
      };

      existingMembership.plan = newPlan;
      existingMembership.paidAmount = newPlan.price;
      await queryRunner.manager.save(existingMembership);

      const userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: user.id } },
      });

      if (userPoints) {
        userPoints.membershipPlan = newPlan;
        await queryRunner.manager.save(userPoints);
      }

      const userRank = await this.userRankRepository.findOne({
        where: { user: { id: user.id } },
      });

      if (userRank) {
        userRank.membershipPlan = newPlan;
        await queryRunner.manager.save(userRank);
      }

      const membershipHistory = this.membershipHistoryRepository.create({
        membership: { id: existingMembership.id },
        action: MembershipAction.UPGRADED,
        notes: 'Plan cambiado directamente por administrador',
        changes: {
          previousPlanId: previousPlan.id,
          previousPlanName: previousPlan.name,
          newPlanId: newPlan.id,
          newPlanName: newPlan.name,
          directUpgrade: true,
        },
      });

      await queryRunner.manager.save(membershipHistory);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Plan cambiado exitosamente para el usuario ${email} de ${previousPlan.name} a ${newPlan.name}`,
        data: {
          userId: user.id,
          email: user.email,
          previousPlan: previousPlan,
          newPlan: {
            id: newPlan.id,
            name: newPlan.name,
            price: newPlan.price,
          },
          membership: {
            id: existingMembership.id,
            startDate: existingMembership.startDate,
            endDate: existingMembership.endDate,
          },
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error en cambio de plan: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private getPlanNameByCode(code: string): string {
    const planMap = {
      EJE: 'Ejecutivo',
      VIP: 'VIP',
      PRE: 'Premium',
    };

    return planMap[code] || code;
  }

  async updatePasswordInternal(
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<string> {
    const { email, newPassword } = updatePasswordDto;
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user)
      throw new NotFoundException(
        `Usuario con el correo electrónico "${email}" no encontrado.`,
      );

    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.userRepository.update(user.id, { password: hashedPassword });
    return 'Contraseña actualizada con éxito';
  }
}
