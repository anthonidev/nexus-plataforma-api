import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationFactory } from 'src/notifications/factory/notification.factory';
import { OrderHistory } from 'src/orders/entities/orders-history.entity';
import { Order } from 'src/orders/entities/orders.entity';
import { OrderAction } from 'src/orders/enums/orders-action.enum';
import { OrderStatus } from 'src/orders/enums/orders-status.enum';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { TreeVolumeService } from './tree-volumen.service';

@Injectable()
export class OrderPaymentService {
    private readonly logger = new Logger(OrderPaymentService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Order)
        private readonly orderRepository: Repository<Order>,
        @InjectRepository(OrderHistory)
        private readonly orderHistoryRepository: Repository<OrderHistory>,
        private readonly treeVolumeService: TreeVolumeService,
        private readonly notificationFactory: NotificationFactory,
    ) { }

    async processOrderPayment(payment: Payment, queryRunner: any) {
        try {
            if (payment.relatedEntityType !== 'order') {
                throw new BadRequestException(
                    'El pago no está relacionado a una orden',
                );
            }

            const user = await this.userRepository.findOne({
                where: { id: payment.user.id },
                relations: ['personalInfo'],
            });

            if (!user) {
                throw new NotFoundException(
                    `Usuario con ID ${payment.user.id} no encontrado`,
                );
            }

            const order = await this.orderRepository.findOne({
                where: { id: payment.relatedEntityId },
            });

            if (!order) {
                throw new NotFoundException(
                    `Orden con ID ${payment.relatedEntityId} no encontrada`,
                );
            }

            if (order.status !== OrderStatus.PENDING) {
                throw new BadRequestException(
                    `La orden no está en estado pendiente`,
                );
            }

            order.status = OrderStatus.APPROVED;
            await queryRunner.manager.save(order);

            const orderHistory = this.orderHistoryRepository.create({
                order: { id: order.id },
                action: OrderAction.APPROVED,
                performedBy: payment.reviewedBy,
                notes: 'Orden aprobada por aprobación de pago',
                changes: {
                    'Estado anterior': OrderStatus.PENDING,
                    'Nuevo estado': OrderStatus.APPROVED,
                },
            });

            await queryRunner.manager.save(orderHistory);

            await this.treeVolumeService.processTreeVolumesOrder(
                user,
                payment.amount,
                queryRunner
            );

            this.logger.log(
                `Pago de orden procesado: ${payment.amount} para el usuario ${user.id}`,
            );

            try {
                await this.notificationFactory.statusOrder(
                    user.id,
                    order.id,
                    OrderStatus.APPROVED,
                    payment.amount,
                )
            } catch (notificationError) {
                this.logger.error(
                    `Error al enviar notificación de aprobación de orden: ${notificationError.message}`,
                    notificationError.stack,
                );
            }

        } catch (error) {
            this.logger.error(
                `Error al procesar pago de orden: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    async processOrderRejection(
        payment: Payment,
        rejectionReason: string,
        queryRunner: any,
    ) {
        try {
            if (payment.relatedEntityType !== 'order') {
                throw new BadRequestException(
                    'El pago no está relacionado a una orden',
                );
            }

            // Get order
            const order = await this.orderRepository.findOne({
                where: { id: payment.relatedEntityId },
            });

            if (!order) {
                throw new NotFoundException(
                    `Orden con ID ${payment.relatedEntityId} no encontrada`,
                );
            }

            if (order.status !== OrderStatus.PENDING) {
                throw new BadRequestException(
                    `La orden no está en estado pendiente`,
                );
            }

            // Update order status
            order.status = OrderStatus.REJECTED;
            await queryRunner.manager.save(order);

            // Create order history
            const orderHistory = this.orderHistoryRepository.create({
                order: { id: order.id },
                action: OrderAction.REJECTED,
                performedBy: payment.reviewedBy,
                notes: `Orden rechazada: ${rejectionReason}`,
                changes: {
                    'Estado anterior': OrderStatus.PENDING,
                    'Nuevo estado': OrderStatus.REJECTED,
                    'Razón del rechazo': rejectionReason,
                },
            });

            await queryRunner.manager.save(orderHistory);

            try {
                await this.notificationFactory.statusOrder(
                    payment.user.id,
                    order.id,
                    OrderStatus.REJECTED,
                    payment.amount,
                );
            } catch (notificationError) {
                this.logger.error(
                    `Error al enviar notificación de rechazo de orden: ${notificationError.message}`,
                    notificationError.stack,
                );
            }

            this.logger.log(
                `Pago de orden rechazado: ${payment.amount} para el usuario ${payment.user.id}. Razón: ${rejectionReason}`,
            );
        } catch (error) {
            this.logger.error(
                `Error al procesar rechazo de pago de orden: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }
}