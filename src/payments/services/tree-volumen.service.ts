import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { Membership, MembershipStatus } from 'src/memberships/entities/membership.entity';
import { WeeklyVolumesHistory } from 'src/points/entities/weekly-volumes-history.entity';
import { VolumeProcessingStatus, VolumeSide, WeeklyVolume } from 'src/points/entities/weekly_volumes.entity';
import { MonthlyVolumeRank, MonthlyVolumeStatus } from 'src/ranks/entities/monthly_volume_ranks.entity';
import { User } from 'src/user/entities/user.entity';
import { getFirstDayOfMonth, getFirstDayOfWeek, getLastDayOfMonth, getLastDayOfWeek } from 'src/utils/dates';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class TreeVolumeService {
    private readonly logger = new Logger('TreeVolumeService');

    constructor(
        @InjectRepository(WeeklyVolume)
        private readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
        @InjectRepository(WeeklyVolumesHistory)
        private readonly weeklyVolumeHistoryRepository: Repository<WeeklyVolumesHistory>,
        @InjectRepository(MonthlyVolumeRank)
        private readonly monthlyVolumeRepository: Repository<MonthlyVolumeRank>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Membership)
        private readonly membershipRepository: Repository<Membership>,
    ) { }

    async processTreeVolumes(
        user: User,
        plan: MembershipPlan,
        queryRunner: any,
        payment: Payment,
    ) {
        try {
            const parents = await this.getAllParents(user.id);

            await Promise.all(
                parents.map(async (parent) => {
                    const parentMembership = await this.membershipRepository.findOne({
                        where: {
                            user: { id: parent.id },
                            status: MembershipStatus.ACTIVE,
                        },
                        relations: ['plan'],
                    });

                    if (!parentMembership?.plan?.commissionPercentage) {
                        this.logger.debug(`El padre ${parent.id} no tiene membresía activa o comisión, saltando`);
                        return;
                    }

                    const side = await this.determineTreeSide(parent.id, user.id);
                    if (!side) {
                        this.logger.warn(
                            `No se pudo determinar el lado del árbol para el usuario ${user.id} con respecto al padre ${parent.id}`,
                        );
                        return;
                    }

                    await Promise.all([
                        this.updateWeeklyVolume(parent, parentMembership.plan, plan.binaryPoints, side, queryRunner, payment),
                        this.updateMonthlyVolume(parent, parentMembership.plan, plan.binaryPoints, side, queryRunner),
                    ]);
                })
            );
        } catch (error) {
            this.logger.error(
                `Error al procesar volúmenes del árbol: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    async processTreeVolumesUpgrade(
        user: User,
        pointsDifference: number,
        queryRunner: any,
        payment: Payment,

    ) {
        try {
            if (pointsDifference <= 0) {
                this.logger.warn(
                    `No hay diferencia de puntos positiva para procesar (${pointsDifference})`,
                );
                return;
            }

            const parents = await this.getAllParents(user.id);

            for (const parent of parents) {
                const parentMembership = await this.membershipRepository.findOne({
                    where: {
                        user: { id: parent.id },
                        status: MembershipStatus.ACTIVE,
                    },
                    relations: ['plan'],
                });

                if (!parentMembership) {
                    this.logger.debug(
                        `El padre ${parent.id} no tiene una membresía activa, saltando`,
                    );
                    continue;
                }

                const parentPlan = parentMembership.plan;

                if (
                    !parentPlan.commissionPercentage ||
                    parentPlan.commissionPercentage <= 0
                ) {
                    this.logger.debug(
                        `El plan ${parentPlan.id} del padre no tiene configurado un porcentaje de comisión, saltando`,
                    );
                    continue;
                }

                const side = await this.determineTreeSide(parent.id, user.id);
                if (!side) {
                    this.logger.warn(
                        `No se pudo determinar el lado del árbol para el usuario ${user.id} con respecto al padre ${parent.id}`,
                    );
                    continue;
                }

                await this.updateWeeklyVolume(
                    parent,
                    parentPlan,
                    pointsDifference,
                    side,
                    queryRunner,
                    payment
                );
                await this.updateMonthlyVolume(
                    parent,
                    parentPlan,
                    pointsDifference,
                    side,
                    queryRunner,
                );
            }
        } catch (error) {
            this.logger.error(
                `Error al procesar volúmenes del árbol para upgrade: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    async processTreeVolumesOrder(
        user: User,
        orderAmount: number,
        queryRunner: any,
        payment: Payment,

    ) {
        try {
            const parents = await this.getAllParents(user.id);

            for (const parent of parents) {
                const parentMembership = await this.membershipRepository.findOne({
                    where: {
                        user: { id: parent.id },
                        status: MembershipStatus.ACTIVE,
                    },
                    relations: ['plan'],
                });

                if (!parentMembership) {
                    this.logger.debug(
                        `El padre ${parent.id} no tiene una membresía activa, saltando`,
                    );
                    continue;
                }

                const parentPlan = parentMembership.plan;

                if (
                    !parentPlan.commissionPercentage ||
                    parentPlan.commissionPercentage <= 0
                ) {
                    this.logger.debug(
                        `El plan ${parentPlan.id} del padre no tiene configurado un porcentaje de comisión, saltando`,
                    );
                    continue;
                }

                const side = await this.determineTreeSide(parent.id, user.id);
                if (!side) {
                    this.logger.warn(
                        `No se pudo determinar el lado del árbol para el usuario ${user.id} con respecto al padre ${parent.id}`,
                    );
                    continue;
                }

                await this.updateWeeklyVolume(
                    parent,
                    parentPlan,
                    orderAmount,
                    side,
                    queryRunner,
                    payment
                );
                await this.updateMonthlyVolume(
                    parent,
                    parentPlan,
                    orderAmount,
                    side,
                    queryRunner,
                );
            }
        } catch (error) {
            this.logger.error(
                `Error al procesar volúmenes del árbol para orden: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    async processTreeVolumesReConsumption(
        user: User,
        reconsumptionAmount: number,
        queryRunner: any,
        payment: Payment,

    ) {
        try {
            const parents = await this.getAllParents(user.id);

            for (const parent of parents) {
                const parentMembership = await this.membershipRepository.findOne({
                    where: {
                        user: { id: parent.id },
                        status: MembershipStatus.ACTIVE,
                    },
                    relations: ['plan'],
                });

                if (!parentMembership) {
                    this.logger.debug(
                        `El padre ${parent.id} no tiene una membresía activa, saltando`,
                    );
                    continue;
                }

                const parentPlan = parentMembership.plan;

                if (
                    !parentPlan.commissionPercentage ||
                    parentPlan.commissionPercentage <= 0
                ) {
                    this.logger.debug(
                        `El plan ${parentPlan.id} del padre no tiene configurado un porcentaje de comisión, saltando`,
                    );
                    continue;
                }

                const side = await this.determineTreeSide(parent.id, user.id);
                if (!side) {
                    this.logger.warn(
                        `No se pudo determinar el lado del árbol para el usuario ${user.id} con respecto al padre ${parent.id}`,
                    );
                    continue;
                }

                await this.updateWeeklyVolume(
                    parent,
                    parentPlan,
                    reconsumptionAmount,
                    side,
                    queryRunner,
                    payment
                );

                await this.updateMonthlyVolume(
                    parent,
                    parentPlan,
                    reconsumptionAmount,
                    side,
                    queryRunner,
                );
            }
        } catch (error) {
            this.logger.error(
                `Error al procesar volúmenes del árbol para reconsumo: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    private async updateWeeklyVolume(
        parent: User,
        parentPlan: MembershipPlan,
        binaryPoints: number,
        side: VolumeSide,
        queryRunner: any,
        payment: Payment,
    ) {
        try {
            const now = new Date();
            const weekStartDate = getFirstDayOfWeek(now);
            const weekEndDate = getLastDayOfWeek(now);

            const existingVolume = await this.weeklyVolumeRepository.findOne({
                where: {
                    user: { id: parent.id },
                    status: VolumeProcessingStatus.PENDING,
                    weekStartDate: weekStartDate,
                    weekEndDate: weekEndDate,
                },
            });

            if (existingVolume) {
                if (side == VolumeSide.LEFT) {
                    existingVolume.leftVolume =
                        Number(existingVolume.leftVolume) + Number(binaryPoints);
                } else {
                    existingVolume.rightVolume =
                        Number(existingVolume.rightVolume) + Number(binaryPoints);
                }
                const history = this.weeklyVolumeHistoryRepository.create({
                    payment: payment,
                    selectedSide: side,
                    volume: binaryPoints,
                    weeklyVolumes: existingVolume,
                });
                await queryRunner.manager.save(history);


                await queryRunner.manager.save(existingVolume);
                this.logger.log(
                    `Volumen semanal actualizado para usuario ${parent.id}: +${binaryPoints} en lado ${side}`,
                );
            } else {
                const newVolume = this.weeklyVolumeRepository.create({
                    user: { id: parent.id },
                    membershipPlan: parentPlan,
                    leftVolume: side == VolumeSide.LEFT ? binaryPoints : 0,
                    rightVolume: side == VolumeSide.RIGHT ? binaryPoints : 0,
                    weekStartDate: weekStartDate,
                    weekEndDate: weekEndDate,
                    status: VolumeProcessingStatus.PENDING,
                    carryOverVolume: 0,
                });

                await queryRunner.manager.save(newVolume);

                const history = this.weeklyVolumeHistoryRepository.create({
                    payment: payment,
                    selectedSide: side,
                    volume: binaryPoints,
                    weeklyVolumes: newVolume,
                });
                await queryRunner.manager.save(history);
                this.logger.log(
                    `Nuevo volumen semanal creado para usuario ${parent.id}: ${binaryPoints} en lado ${side}`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Error al actualizar volumen semanal: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    private async updateMonthlyVolume(
        parent: User,
        parentPlan: MembershipPlan,
        binaryPoints: number,
        side: VolumeSide,
        queryRunner: any,
    ) {
        try {
            const now = new Date();
            const monthStartDate = getFirstDayOfMonth(now);
            const monthEndDate = getLastDayOfMonth(now);
            const existingVolume = await this.monthlyVolumeRepository.findOne({
                where: {
                    user: { id: parent.id },
                    status: MonthlyVolumeStatus.PENDING,
                    monthStartDate: monthStartDate,
                    monthEndDate: monthEndDate,
                },
            });
            if (existingVolume) {
                if (side === VolumeSide.LEFT) {
                    existingVolume.leftVolume =
                        Number(existingVolume.leftVolume) + Number(binaryPoints);
                    existingVolume.leftDirects = existingVolume.leftDirects || 0;
                } else {
                    existingVolume.rightVolume =
                        Number(existingVolume.rightVolume) + Number(binaryPoints);
                    existingVolume.rightDirects = existingVolume.rightDirects || 0;
                }

                existingVolume.totalVolume =
                    Number(existingVolume.leftVolume) +
                    Number(existingVolume.rightVolume);

                await queryRunner.manager.save(existingVolume);
                this.logger.log(
                    `Volumen mensual actualizado para usuario ${parent.id}: +${binaryPoints} en lado ${side}`,
                );
            } else {
                const newVolume = this.monthlyVolumeRepository.create({
                    user: { id: parent.id },
                    membershipPlan: parentPlan,
                    leftVolume: side === VolumeSide.LEFT ? binaryPoints : 0,
                    rightVolume: side === VolumeSide.RIGHT ? binaryPoints : 0,
                    totalVolume: binaryPoints,
                    leftDirects: 0,
                    rightDirects: 0,
                    monthStartDate: monthStartDate,
                    monthEndDate: monthEndDate,
                    status: MonthlyVolumeStatus.PENDING,
                });

                await queryRunner.manager.save(newVolume);
                this.logger.log(
                    `Nuevo volumen mensual creado para usuario ${parent.id}: ${binaryPoints} en lado ${side}`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Error al actualizar volumen mensual: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    private async determineTreeSide(
        parentId: string,
        childId: string,
    ): Promise<VolumeSide | null> {
        const parent = await this.userRepository.findOne({
            where: { id: parentId },
            relations: ['leftChild', 'rightChild'],
        });

        if (parent.leftChild && parent.leftChild.id === childId) {
            return VolumeSide.LEFT;
        }

        if (parent.rightChild && parent.rightChild.id === childId) {
            return VolumeSide.RIGHT;
        }

        const isLeftDescendant = await this.isDescendantOfSide(
            parentId,
            childId,
            VolumeSide.LEFT,
        );
        if (isLeftDescendant) {
            return VolumeSide.LEFT;
        }

        const isRightDescendant = await this.isDescendantOfSide(
            parentId,
            childId,
            VolumeSide.RIGHT,
        );
        if (isRightDescendant) {
            return VolumeSide.RIGHT;
        }

        return null;
    }

    private async isDescendantOfSide(
        ancestorId: string,
        descendantId: string,
        side: VolumeSide,
    ): Promise<boolean> {
        const ancestor = await this.userRepository.findOne({
            where: { id: ancestorId },
            relations: ['leftChild', 'rightChild'],
        });

        if (!ancestor) return false;

        const childId =
            side === VolumeSide.LEFT
                ? ancestor.leftChild?.id
                : ancestor.rightChild?.id;

        if (!childId) return false;
        if (childId === descendantId) return true;

        const child = await this.userRepository.findOne({
            where: { id: childId },
            relations: ['leftChild', 'rightChild'],
        });

        if (!child) return false;

        if (child.leftChild) {
            const isLeftDescendant = await this.isDescendantOfSide(
                child.id,
                descendantId,
                VolumeSide.LEFT,
            );
            if (isLeftDescendant) return true;
        }

        if (child.rightChild) {
            const isRightDescendant = await this.isDescendantOfSide(
                child.id,
                descendantId,
                VolumeSide.RIGHT,
            );
            if (isRightDescendant) return true;
        }

        return false;
    }

    private async getAllParents(userId: string): Promise<User[]> {
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