import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipReconsumption, ReconsumptionStatus } from 'src/memberships/entities/membership-recosumption.entity';
import { Membership } from 'src/memberships/entities/membership.entity';
import { MembershipAction, MembershipHistory } from 'src/memberships/entities/membership_history.entity';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { TreeVolumeService } from './tree-volumen.service';

@Injectable()
export class ReconsumptionService {
    private readonly logger = new Logger('ReconsumptionService');

    constructor(
        @InjectRepository(MembershipReconsumption)
        private readonly reconsumptionRepository: Repository<MembershipReconsumption>,
        @InjectRepository(Membership)
        private readonly membershipRepository: Repository<Membership>,
        @InjectRepository(MembershipHistory)
        private readonly membershipHistoryRepository: Repository<MembershipHistory>,
        private readonly treeVolumeService: TreeVolumeService
    ) { }

    async processReconsumptionPayment(
        payment: Payment,
        queryRunner: any,
    ) {
        if (payment.relatedEntityType !== 'membership_reconsumption') {
            throw new BadRequestException(
                'El pago no está relacionado a un reconsumo',
            );
        }

        const reconsumption = await this.reconsumptionRepository.findOne({
            where: { id: payment.relatedEntityId },
            relations: ['membership', 'membership.user', 'membership.plan'],
        });

        if (!reconsumption) {
            throw new NotFoundException(
                `Reconsumo con ID ${payment.relatedEntityId} no encontrado`,
            );
        }

        if (reconsumption.status !== ReconsumptionStatus.PENDING) {
            throw new BadRequestException(`El reconsumo no está en estado pendiente`);
        }

        const membership = reconsumption.membership;
        const user = membership.user;
        const plan = membership.plan;

        // Validar fechas para reconsumo
        const today = new Date();
        const nextReconsumptionDate = new Date(membership.nextReconsumptionDate);

        if (today < nextReconsumptionDate) {
            throw new BadRequestException(
                `No es posible aprobar el reconsumo. La fecha de reconsumo (${nextReconsumptionDate.toISOString().split('T')[0]}) aún no ha llegado.`,
            );
        }

        // Actualizar fechas de membresía
        const oldStartDate = new Date(membership.startDate);
        const oldEndDate = new Date(membership.endDate);

        // Calcular nuevas fechas
        const newStartDate = new Date(oldStartDate);
        newStartDate.setMonth(newStartDate.getMonth() + 1);

        const newEndDate = new Date(oldEndDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);

        const newNextReconsumptionDate = new Date(newEndDate);
        newNextReconsumptionDate.setDate(newNextReconsumptionDate.getDate() + 1);

        // Actualizar membresía
        membership.startDate = newStartDate;
        membership.endDate = newEndDate;
        membership.nextReconsumptionDate = newNextReconsumptionDate;
        await queryRunner.manager.save(membership);

        // Actualizar reconsumo
        reconsumption.status = ReconsumptionStatus.ACTIVE;
        await queryRunner.manager.save(reconsumption);

        // Procesar volúmenes del árbol con el monto de reconsumo
        const minimumReconsumptionAmount = membership.minimumReconsumptionAmount;
        await this.treeVolumeService.processTreeVolumesReConsumption(
            user,
            plan,
            minimumReconsumptionAmount,
            queryRunner,
            payment
        );

        // Registrar historial
        const membershipHistory = this.membershipHistoryRepository.create({
            membership: { id: membership.id },
            action: MembershipAction.RENEWED,
            performedBy: payment.reviewedBy,
            notes: 'Reconsumo aprobado',
            changes: {
                'Fecha anterior de inicio': oldStartDate.toISOString().split('T')[0],
                'Fecha nueva de inicio': newStartDate.toISOString().split('T')[0],
                'Fecha anterior de fin': oldEndDate.toISOString().split('T')[0],
                'Fecha nueva de fin': newEndDate.toISOString().split('T')[0],
                'Fecha anterior de reconsumo': nextReconsumptionDate
                    .toISOString()
                    .split('T')[0],
                'Fecha nueva de reconsumo': newNextReconsumptionDate
                    .toISOString()
                    .split('T')[0],
                'Monto de reconsumo': reconsumption.amount,
            },
        });

        await queryRunner.manager.save(membershipHistory);

        this.logger.log(
            `Reconsumo procesado exitosamente para la membresía ${membership.id}`,
        );
    }

    async processReconsumptionRejection(
        payment: Payment,
        rejectionReason: string,
        queryRunner: any,
    ) {
        if (payment.relatedEntityType !== 'membership_reconsumption') {
            throw new BadRequestException(
                'El pago no está relacionado a un reconsumo',
            );
        }

        const reconsumption = await this.reconsumptionRepository.findOne({
            where: { id: payment.relatedEntityId },
            relations: ['membership', 'membership.user'],
        });

        if (!reconsumption) {
            throw new NotFoundException(
                `Reconsumo con ID ${payment.relatedEntityId} no encontrado`,
            );
        }

        if (reconsumption.status !== ReconsumptionStatus.PENDING) {
            throw new BadRequestException(`El reconsumo no está en estado pendiente`);
        }

        const membership = reconsumption.membership;

        // Actualizar reconsumo a CANCELLED
        reconsumption.status = ReconsumptionStatus.CANCELLED;
        await queryRunner.manager.save(reconsumption);

        // Registrar historial
        const membershipHistory = this.membershipHistoryRepository.create({
            membership: { id: membership.id },
            action: MembershipAction.STATUS_CHANGED,
            performedBy: payment.reviewedBy,
            notes: `Reconsumo rechazado: ${rejectionReason}`,
            changes: {
                'Estado actual': 'Pendiente',
                'Nuevo estado': 'Cancelado',
                'Reconsumo rechazado': rejectionReason,
            },
        });

        await queryRunner.manager.save(membershipHistory);

        this.logger.log(
            `Reconsumo ${reconsumption.id} rechazado: ${rejectionReason}`,
        );
    }
}