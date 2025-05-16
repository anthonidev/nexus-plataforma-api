import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { Membership, MembershipStatus } from 'src/memberships/entities/membership.entity';
import { NotificationFactory } from 'src/notifications/factory/notification.factory';
import { PointsTransactionPayment } from 'src/points/entities/points-transactions-payments.entity';
import { PointsTransaction, PointTransactionStatus, PointTransactionType } from 'src/points/entities/points_transactions.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class DirectBonusService {
    private readonly logger = new Logger('DirectBonusService');

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Membership)
        private readonly membershipRepository: Repository<Membership>,
        @InjectRepository(UserPoints)
        private readonly userPointsRepository: Repository<UserPoints>,
        @InjectRepository(PointsTransaction)
        private readonly pointsTransactionRepository: Repository<PointsTransaction>,
        @InjectRepository(PointsTransactionPayment)
        private readonly pointsTransactionPaymentRepository: Repository<PointsTransactionPayment>,
        private readonly notificationFactory: NotificationFactory,

    ) { }

    async processDirectBonus(
        user: User,
        plan: MembershipPlan,
        queryRunner: any,
        payment: Payment
    ) {
        try {
            const referrer = await this.userRepository.findOne({
                where: { referralCode: user.referrerCode },
                relations: ['role', 'personalInfo'],
            });

            if (!referrer) {
                this.logger.warn(
                    `No se encontró referente con código ${user.referrerCode}`,
                );
                return;
            }

            const referrerMembership = await this.membershipRepository.findOne({
                where: {
                    user: { id: referrer.id },
                    status: MembershipStatus.ACTIVE,
                },
                relations: ['plan'],
            });

            if (!referrerMembership) {
                this.logger.warn(
                    `El referente ${referrer.id} no tiene una membresía activa`,
                );
                return;
            }

            const referrerPlan = referrerMembership.plan;

            if (
                !referrerPlan.directCommissionAmount ||
                referrerPlan.directCommissionAmount <= 0
            ) {
                this.logger.warn(
                    `El plan ${referrerPlan.id} del referente no tiene configurada una comisión directa`,
                );
                return;
            }

            const directBonus =
                referrerPlan.directCommissionAmount * (plan.price / 100);

            const referrerPoints = await this.userPointsRepository.findOne({
                where: { user: { id: referrer.id } },
            });

            if (referrerPoints) {
                referrerPoints.availablePoints = Number(referrerPoints.availablePoints) + directBonus;
                referrerPoints.totalEarnedPoints = Number(referrerPoints.totalEarnedPoints) + directBonus;
                await queryRunner.manager.save(referrerPoints);
            } else {
                const newReferrerPoints = this.userPointsRepository.create({
                    user: { id: referrer.id },
                    membershipPlan: referrerPlan,
                    availablePoints: directBonus,
                    totalEarnedPoints: directBonus,
                    totalWithdrawnPoints: 0,
                });
                await queryRunner.manager.save(newReferrerPoints);
            }

            const pointsTransaction = this.pointsTransactionRepository.create({
                user: { id: referrer.id },
                membershipPlan: referrerPlan,
                type: PointTransactionType.DIRECT_BONUS,
                amount: directBonus,
                status: PointTransactionStatus.COMPLETED,
                metadata: {
                    'Usuario referido':
                        user.personalInfo.firstName + ' ' + user.personalInfo.lastName,
                    'Nombre del plan': plan.name,
                    'Precio del plan': plan.price,
                    'Comisión directa': referrerPlan.directCommissionAmount,
                },
            });

            try {
                await this.notificationFactory.directBonus(
                    referrer.id,
                    directBonus,
                    user.personalInfo.firstName + ' ' + user.personalInfo.lastName,
                    user.id,
                )
            } catch (notificationError) {
                this.logger.error(
                    `Error al enviar notificación de rechazo: ${notificationError.message}`,
                    notificationError.stack,
                );
            }

            await queryRunner.manager.save(pointsTransaction);

            const pointsTransactionPayment = this.pointsTransactionPaymentRepository.create({
                pointsTransaction: { id: pointsTransaction.id },
                payment: { id: payment.id },
            });

            await queryRunner.manager.save(pointsTransactionPayment);

            this.logger.log(
                `Bono directo procesado: ${directBonus} puntos para el usuario ${referrer.id}`,
            );
        } catch (error) {
            this.logger.error(
                `Error al procesar bono directo: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    async processDirectBonusUpgrade(
        user: User,
        toPlan: MembershipPlan,
        fromPlan: MembershipPlan,
        priceDifference: number,
        queryRunner: any,
        payment: Payment
    ) {
        try {
            const referrer = await this.userRepository.findOne({
                where: { referralCode: user.referrerCode },
                relations: ['role'],
            });

            if (!referrer) {
                this.logger.warn(
                    `No se encontró referente con código ${user.referrerCode}`,
                );
                return;
            }

            const referrerMembership = await this.membershipRepository.findOne({
                where: {
                    user: { id: referrer.id },
                    status: MembershipStatus.ACTIVE,
                },
                relations: ['plan'],
            });

            if (!referrerMembership) {
                this.logger.warn(
                    `El referente ${referrer.id} no tiene una membresía activa`,
                );
                return;
            }

            const referrerPlan = referrerMembership.plan;

            if (
                !referrerPlan.directCommissionAmount ||
                referrerPlan.directCommissionAmount <= 0
            ) {
                this.logger.warn(
                    `El plan ${referrerPlan.id} del referente no tiene configurada una comisión directa`,
                );
                return;
            }

            const directBonus =
                referrerPlan.directCommissionAmount * (priceDifference / 100);

            if (directBonus <= 0) {
                this.logger.warn(`No hay bono directo para procesar (${directBonus})`);
                return;
            }

            const referrerPoints = await this.userPointsRepository.findOne({
                where: { user: { id: referrer.id } },
            });

            if (referrerPoints) {
                referrerPoints.availablePoints =
                    Number(referrerPoints.availablePoints) + directBonus;
                referrerPoints.totalEarnedPoints =
                    Number(referrerPoints.totalEarnedPoints) + directBonus;
                await queryRunner.manager.save(referrerPoints);
            } else {
                const newReferrerPoints = this.userPointsRepository.create({
                    user: { id: referrer.id },
                    membershipPlan: referrerPlan,
                    availablePoints: directBonus,
                    totalEarnedPoints: directBonus,
                    totalWithdrawnPoints: 0,
                });
                await queryRunner.manager.save(newReferrerPoints);
            }

            const pointsTransaction = this.pointsTransactionRepository.create({
                user: { id: referrer.id },
                membershipPlan: referrerPlan,
                type: PointTransactionType.DIRECT_BONUS,
                amount: directBonus,
                status: PointTransactionStatus.COMPLETED,
                metadata: {
                    'Usuario referido':
                        user.personalInfo.firstName + ' ' + user.personalInfo.lastName,
                    'Es actualización': 'Sí',
                    'Plan anterior': fromPlan.name,
                    'Precio anterior': fromPlan.price,
                    'Plan nuevo': toPlan.name,
                    'Precio nuevo': toPlan.price,
                    'Diferencia de precio': priceDifference,
                    'Comisión directa': referrerPlan.directCommissionAmount,
                },
            });
            await queryRunner.manager.save(pointsTransaction); //faltaba agregar esto
            const pointsTransactionPayment = this.pointsTransactionPaymentRepository.create({
                pointsTransaction: { id: pointsTransaction.id },
                payment: payment,
            });

            await queryRunner.manager.save(pointsTransactionPayment);
            try {
                await this.notificationFactory.directBonus(
                    referrer.id,
                    directBonus,
                    user.personalInfo.firstName + ' ' + user.personalInfo.lastName,
                    user.id,
                )
            } catch (notificationError) {
                this.logger.error(
                    `Error al enviar notificación de rechazo: ${notificationError.message}`,
                    notificationError.stack,
                );
            }

            await queryRunner.manager.save(pointsTransaction);

            this.logger.log(
                `Bono directo por upgrade procesado: ${directBonus} puntos para el usuario ${referrer.id}`,
            );
        } catch (error) {
            this.logger.error(
                `Error al procesar bono directo por upgrade: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }
}