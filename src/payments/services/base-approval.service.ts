import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { NotificationFactory } from 'src/notifications/factory/notification.factory';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { MembershipReconsumption } from 'src/memberships/entities/membership-recosumption.entity';
import { Membership } from 'src/memberships/entities/membership.entity';
import { MembershipHistory } from 'src/memberships/entities/membership_history.entity';
import { MembershipUpgrade } from 'src/memberships/entities/membership_upgrades.entity';
import { PointsTransaction } from 'src/points/entities/points_transactions.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { WeeklyVolume } from 'src/points/entities/weekly_volumes.entity';
import { MonthlyVolumeRank } from 'src/ranks/entities/monthly_volume_ranks.entity';
import { Rank } from 'src/ranks/entities/ranks.entity';
import { UserRank } from 'src/ranks/entities/user_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class BaseApprovalService {
    protected readonly logger = new Logger('BaseApprovalService');

    constructor(
        @InjectRepository(Payment)
        protected readonly paymentRepository: Repository<Payment>,
        @InjectRepository(User)
        protected readonly userRepository: Repository<User>,
        @InjectRepository(Membership)
        protected readonly membershipRepository: Repository<Membership>,
        @InjectRepository(MembershipPlan)
        protected readonly membershipPlanRepository: Repository<MembershipPlan>,
        @InjectRepository(MembershipHistory)
        protected readonly membershipHistoryRepository: Repository<MembershipHistory>,
        @InjectRepository(UserPoints)
        protected readonly userPointsRepository: Repository<UserPoints>,
        @InjectRepository(PointsTransaction)
        protected readonly pointsTransactionRepository: Repository<PointsTransaction>,
        @InjectRepository(WeeklyVolume)
        protected readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
        @InjectRepository(MembershipUpgrade)
        protected readonly membershipUpgradeRepository: Repository<MembershipUpgrade>,
        @InjectRepository(MembershipReconsumption)
        protected readonly reconsumptionRepository: Repository<MembershipReconsumption>,
        @InjectRepository(Rank)
        protected readonly rankRepository: Repository<Rank>,
        @InjectRepository(UserRank)
        protected readonly userRankRepository: Repository<UserRank>,
        @InjectRepository(MonthlyVolumeRank)
        protected readonly monthlyVolumeRankRepository: Repository<MonthlyVolumeRank>,
        protected readonly notificationFactory: NotificationFactory,
        @InjectDataSource()
        protected readonly dataSource: DataSource,
    ) { }

    protected async createOrUpdateUserRank(
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

    protected async getAllParents(userId: string): Promise<User[]> {
        const parents: User[] = [];
        let currentUser = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['parent'],
        });

        while (currentUser && currentUser.parent) {
            parents.push(currentUser.parent);

            currentUser = await this.userRepository.findOne({
                where: { id: currentUser.parent.id },
                relations: ['parent'],
            });
        }

        return parents;
    }
}