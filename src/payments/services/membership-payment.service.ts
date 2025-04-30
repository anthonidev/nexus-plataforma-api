import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { Membership, MembershipStatus } from 'src/memberships/entities/membership.entity';
import { MembershipAction, MembershipHistory } from 'src/memberships/entities/membership_history.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { Rank } from 'src/ranks/entities/ranks.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import { getDates } from 'src/utils/dates';
import { DataSource, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { DirectBonusService } from './direct-bonus.service';
import { TreeVolumeService } from './tree-volumen.service';

@Injectable()
export class MembershipPaymentService {
    private readonly logger = new Logger('MembershipPaymentService');

    constructor(
        @InjectRepository(Membership)
        private readonly membershipRepository: Repository<Membership>,
        @InjectRepository(MembershipPlan)
        private readonly membershipPlanRepository: Repository<MembershipPlan>,
        @InjectRepository(MembershipHistory)
        private readonly membershipHistoryRepository: Repository<MembershipHistory>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserPoints)
        private readonly userPointsRepository: Repository<UserPoints>,
        @InjectRepository(Rank)
        private readonly rankRepository: Repository<Rank>,
        @InjectRepository(UserRank)
        private readonly userRankRepository: Repository<UserRank>,

        private readonly directBonusService: DirectBonusService,
        private readonly treeVolumeService: TreeVolumeService,

        private readonly dataSource: DataSource,
    ) { }

    async processMembershipPayment(payment: Payment, queryRunner: any) {
        if (payment.relatedEntityType !== 'membership') {
            throw new BadRequestException(
                'El pago no está relacionado a una membresía',
            );
        }

        const membership = await this.membershipRepository.findOne({
            where: { id: payment.relatedEntityId },
            relations: ['user', 'plan', 'user.personalInfo'],
        });

        if (!membership) {
            throw new NotFoundException(
                `Membresía con ID ${payment.relatedEntityId} no encontrada`,
            );
        }

        if (membership.status !== MembershipStatus.PENDING) {
            throw new BadRequestException(`La membresía no está en estado pendiente`);
        }

        const user = membership.user;
        const plan = membership.plan;

        const userPoints = await this.userPointsRepository.findOne({
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

        if (user.referrerCode) {
            await this.directBonusService.processDirectBonus(user, plan, queryRunner);
        }

        await this.treeVolumeService.processTreeVolumes(user, plan, queryRunner);
        await this.createOrUpdateUserRank(user, plan, queryRunner);

        const now = new Date();
        const dates = getDates(now);

        membership.status = MembershipStatus.ACTIVE;
        membership.startDate = dates.startDate;
        membership.endDate = dates.endDate;
        membership.nextReconsumptionDate = dates.nextReconsumptionDate;

        await queryRunner.manager.save(membership);

        const membershipHistory = this.membershipHistoryRepository.create({
            membership: { id: membership.id },
            action: MembershipAction.STATUS_CHANGED,
            performedBy: payment.reviewedBy,
            notes: 'Membresía activada por aprobación de pago',
            changes: {
                'Estado anterior': 'Pendiente',
                'Nuevo estado': 'Activo',
                'Fecha de inicio': membership.startDate.toISOString().split('T')[0],
                'Fecha de fin': membership.endDate.toISOString().split('T')[0],
                'Próxima fecha de reconsumo': membership.nextReconsumptionDate
                    .toISOString()
                    .split('T')[0],
            },
        });

        await queryRunner.manager.save(membershipHistory);
    }

    private async createOrUpdateUserRank(
        user: User,
        plan: MembershipPlan,
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