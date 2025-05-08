import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { Product } from 'src/ecommerce/entities/products.entity';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { PaymentImage } from 'src/payments/entities/payment-image.entity';
import { MethodPayment, Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import { PointsTransaction, PointTransactionStatus, PointTransactionType } from 'src/points/entities/points_transactions.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, In, Repository } from 'typeorm';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrdersDetails } from '../entities/orders-details.entity';
import { OrderHistory } from '../entities/orders-history.entity';
import { Order } from '../entities/orders.entity';
import { OrderAction } from '../enums/orders-action.enum';
import { OrderStatus } from '../enums/orders-status.enum';

@Injectable()
export class OrderCreationService {
    private readonly logger = new Logger(OrderCreationService.name);

    constructor(
        @InjectRepository(Order)
        private readonly orderRepository: Repository<Order>,
        @InjectRepository(OrdersDetails)
        private readonly orderDetailsRepository: Repository<OrdersDetails>,
        @InjectRepository(OrderHistory)
        private readonly orderHistoryRepository: Repository<OrderHistory>,
        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,
        @InjectRepository(PaymentImage)
        private readonly paymentImageRepository: Repository<PaymentImage>,
        @InjectRepository(PaymentConfig)
        private readonly paymentConfigRepository: Repository<PaymentConfig>,
        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(PointsTransaction)
        private readonly pointsTransactionRepository: Repository<PointsTransaction>,
        private readonly dataSource: DataSource,
        private readonly cloudinaryService: CloudinaryService,
    ) { }

    async createOrder(
        userId: string,
        createOrderDto: CreateOrderDto,
        files?: Express.Multer.File[],
    ) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const user = await this.userRepository.findOne({
                where: { id: userId },
            });

            if (!user) {
                throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
            }

            const paymentConfig = await this.paymentConfigRepository.findOne({
                where: { code: 'ORDER_PAYMENT' },
            });

            if (!paymentConfig || !paymentConfig.isActive) {
                throw new BadRequestException(
                    'La opción de pago para órdenes no está disponible',
                );
            }

            // Validar según método de pago
            if (createOrderDto.methodPayment === MethodPayment.VOUCHER) {
                if (!files || files.length === 0) {
                    throw new BadRequestException(
                        'Se requiere al menos una imagen de comprobante de pago para el método VOUCHER'
                    );
                }

                if (
                    !createOrderDto.payments ||
                    !Array.isArray(createOrderDto.payments) ||
                    createOrderDto.payments.length === 0
                ) {
                    throw new BadRequestException('Se requieren detalles de pago para el método VOUCHER');
                }

                if (files.length !== createOrderDto.payments.length) {
                    throw new BadRequestException(
                        `El número de imágenes (${files.length}) no coincide con el número de detalles de pago (${createOrderDto.payments.length})`
                    );
                }
            } else if (createOrderDto.methodPayment !== MethodPayment.POINTS) {
                throw new BadRequestException(
                    'Método de pago no soportado'
                );
            }

            // Validar y calcular los productos
            if (
                !createOrderDto.items ||
                !Array.isArray(createOrderDto.items) ||
                createOrderDto.items.length === 0
            ) {
                throw new BadRequestException('Se requieren productos para la orden');
            }

            // Validar los productos y calcular el total
            let calculatedTotal = 0;
            const orderItems = [];

            for (const item of createOrderDto.items) {
                const product = await this.productRepository.findOne({
                    where: { id: item.productId, isActive: true },
                });

                if (!product) {
                    throw new NotFoundException(
                        `Producto con ID ${item.productId} no encontrado o no está activo`,
                    );
                }

                if (item.quantity <= 0) {
                    throw new BadRequestException(
                        `La cantidad para el producto ${product.name} debe ser mayor a 0`,
                    );
                }

                // Usar el precio de miembro
                const itemPrice = product.memberPrice;
                const itemTotal = itemPrice * item.quantity;
                calculatedTotal += itemTotal;

                orderItems.push({
                    product,
                    quantity: item.quantity,
                    price: itemPrice,
                });
            }

            // Verificar que el total enviado coincida con el calculado
            if (Math.abs(calculatedTotal - createOrderDto.totalAmount) > 0.01) {
                throw new BadRequestException(
                    `El monto total enviado (${createOrderDto.totalAmount}) no coincide con el calculado (${calculatedTotal})`,
                );
            }

            // Crear la orden
            const order = this.orderRepository.create({
                user: { id: userId },
                totalAmount: createOrderDto.totalAmount,
                totalItems: orderItems.reduce((sum, item) => sum + item.quantity, 0),
                status: OrderStatus.PENDING,
                metadata: {
                    paymentReference: createOrderDto.paymentReference,
                    notes: createOrderDto.notes,
                },
            });

            const savedOrder = await queryRunner.manager.save(order);

            // Crear los detalles de la orden
            let productos = []
            for (const item of orderItems) {
                const orderDetail = this.orderDetailsRepository.create({
                    order: savedOrder,
                    product: item.product,
                    quantity: item.quantity,
                    price: item.price,
                });
                await queryRunner.manager.save(orderDetail);
                productos.push({
                    "SKU": item.product.sku,
                    "Nombre": item.product.name,
                    "Cantidad": item.quantity,
                    "Precio": item.price,
                });
            }

            // Crear el historial de la orden
            const orderHistory = this.orderHistoryRepository.create({
                order: savedOrder,
                action: OrderAction.CREATED,
                notes: createOrderDto.notes || 'Orden creada',
                performedBy: { id: userId },
            });

            await queryRunner.manager.save(orderHistory);

            savedOrder.metadata = {
                ...savedOrder.metadata,
                "Productos": productos,
            };
            await queryRunner.manager.save(savedOrder);

            // Crear el pago
            const payment = this.paymentRepository.create({
                user: { id: userId },
                paymentConfig: { id: paymentConfig.id },
                amount: createOrderDto.totalAmount,
                status: PaymentStatus.PENDING,
                relatedEntityType: 'order',
                relatedEntityId: savedOrder.id,
                methodPayment: createOrderDto.methodPayment,
                metadata: {
                    "Total de productos": savedOrder.totalAmount,
                    "Número de productos": savedOrder.totalItems,
                    "Productos": productos,
                },
            });

            const savedPayment = await queryRunner.manager.save(payment);

            // Procesar según el método de pago
            if (createOrderDto.methodPayment === MethodPayment.VOUCHER) {
                // Validar fileIndex
                for (const payment of createOrderDto.payments) {
                    if (
                        payment.fileIndex === undefined ||
                        payment.fileIndex < 0 ||
                        payment.fileIndex >= files.length
                    ) {
                        throw new BadRequestException(
                            `El fileIndex ${payment.fileIndex} no es válido. Debe estar entre 0 y ${files.length - 1}`
                        );
                    }
                }

                // Subir imágenes a Cloudinary
                const cloudinaryIds = [];
                const uploadedImages = [];
                const cloudinaryUploads = [];

                for (let i = 0; i < files.length; i++) {
                    try {
                        const cloudinaryResponse = await this.cloudinaryService.uploadImage(
                            files[i],
                            'payments',
                        );
                        cloudinaryIds.push(cloudinaryResponse.publicId);
                        cloudinaryUploads[i] = cloudinaryResponse;
                    } catch (uploadError) {
                        this.logger.error(`Error al subir imagen: ${uploadError.message}`);
                        throw {
                            message: `Error al subir imagen: ${uploadError.message}`,
                            cloudinaryIds,
                        };
                    }
                }

                // Guardar imágenes de pago
                for (const paymentDetail of createOrderDto.payments) {
                    const fileIndex = paymentDetail.fileIndex;
                    const cloudinaryResponse = cloudinaryUploads[fileIndex];

                    const paymentImage = this.paymentImageRepository.create({
                        payment: { id: savedPayment.id },
                        url: cloudinaryResponse.url,
                        cloudinaryPublicId: cloudinaryResponse.publicId,
                        amount: paymentDetail.amount,
                        bankName: paymentDetail.bankName,
                        transactionReference: paymentDetail.transactionReference,
                        transactionDate: new Date(paymentDetail.transactionDate),
                        isActive: true,
                    });

                    const savedImage = await queryRunner.manager.save(paymentImage);
                    uploadedImages.push({
                        id: savedImage.id,
                        url: savedImage.url,
                        bankName: savedImage.bankName,
                        transactionReference: savedImage.transactionReference,
                        amount: savedImage.amount,
                        fileIndex: fileIndex,
                    });
                }
            } else if (createOrderDto.methodPayment === MethodPayment.POINTS) {
                // Buscar transacciones de puntos disponibles
                const availableTransactions = await this.pointsTransactionRepository.find({
                    where: {
                        user: { id: userId },
                        status: PointTransactionStatus.COMPLETED,
                        type: In([PointTransactionType.BINARY_COMMISSION, PointTransactionType.DIRECT_BONUS]),
                    },
                    order: { createdAt: 'ASC' },
                });

                console.log('Transacciones de puntos disponibles:', availableTransactions);

                // Verificar si hay suficientes puntos disponibles
                const totalAvailablePoints = availableTransactions.reduce(
                    (sum, transaction) => sum + Number(transaction.amount) - Number(transaction.withdrawnAmount || 0),
                    0
                );

                if (totalAvailablePoints < createOrderDto.totalAmount) {
                    throw new BadRequestException(
                        `No hay suficientes puntos disponibles (${totalAvailablePoints}) para cubrir el total de la orden (${createOrderDto.totalAmount})`
                    );
                }

                // Seleccionar transacciones para cubrir el monto total
                let remainingAmount = createOrderDto.totalAmount;
                const selectedTransactions = [];

                for (const transaction of availableTransactions) {
                    if (remainingAmount <= 0) break;

                    const availableAmount = Number(transaction.amount) - Number(transaction.withdrawnAmount || 0);

                    if (availableAmount <= 0) continue;

                    const amountToUse = Math.min(availableAmount, remainingAmount);

                    selectedTransactions.push({
                        transaction,
                        amountToUse
                    });

                    remainingAmount -= amountToUse;
                }

                // Crear imágenes de pago con transacciones de puntos
                for (const { transaction, amountToUse } of selectedTransactions) {
                    const paymentImage = this.paymentImageRepository.create({
                        payment: { id: savedPayment.id },
                        pointsTransaction: { id: transaction.id },
                        amount: amountToUse,
                        transactionReference: `Puntos-${transaction.id}`,
                        bankName: 'Nexus Points',
                        transactionDate: new Date(),
                        isActive: true,
                    });

                    await queryRunner.manager.save(paymentImage);

                    // Actualizar la transacción de puntos
                    transaction.withdrawnAmount = (Number(transaction.withdrawnAmount || 0) + amountToUse);
                    await queryRunner.manager.save(transaction);
                }
                // Actualizar el estado del pago a COMPLETED
                savedPayment.status = PaymentStatus.APPROVED;
                savedPayment.metadata = {
                    ...savedPayment.metadata,
                    "Puntos utilizados": createOrderDto.totalAmount,
                };
                // TODO: AGREGAR HISTORIAL DE PUNTOS
                // TODO: DESCUENTO DE PUNTOS 

                const pointsTransaction = this.pointsTransactionRepository.create({
                    user: { id: userId },
                    amount: createOrderDto.totalAmount,
                    type: PointTransactionType.WITHDRAWAL,
                    status: PointTransactionStatus.COMPLETED,
                    metadata: {
                        "Tipo de transacción": PointTransactionType.WITHDRAWAL,
                        "Puntos utilizados": createOrderDto.totalAmount,
                    }
                });
                await queryRunner.manager.save(pointsTransaction);

                await queryRunner.manager.save(savedPayment);

                // Actualizar orden histórico
                const newOrderHistory = this.orderHistoryRepository.create({
                    order: savedOrder,
                    action: OrderAction.APPROVED,
                    notes: `Pago aprobado con ${createOrderDto.totalAmount} puntos`,
                    performedBy: { id: userId },
                });
                await queryRunner.manager.save(newOrderHistory);

                // TODO: ACTUALIZAR VOLUMEN SEMANAL Y VOLUMEN MENSUAL


            }

            await queryRunner.commitTransaction();

            return {
                success: true,
                message: 'Orden creada exitosamente. Pendiente de aprobación.',
                order: {
                    id: savedOrder.id,
                    totalAmount: savedOrder.totalAmount,
                    totalItems: savedOrder.totalItems,
                    status: savedOrder.status,
                    createdAt: savedOrder.createdAt,
                },
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();

            // Manejo de errores para imágenes subidas a Cloudinary
            if (error.cloudinaryIds && Array.isArray(error.cloudinaryIds)) {
                for (const publicId of error.cloudinaryIds) {
                    try {
                        await this.cloudinaryService.deleteImage(publicId);
                        this.logger.log(`Imagen eliminada de Cloudinary: ${publicId}`);
                    } catch (deleteErr) {
                        this.logger.error(
                            `Error al eliminar imagen de Cloudinary: ${deleteErr.message}`,
                        );
                    }
                }
            }

            this.logger.error(`Error al crear orden: ${error.message}`);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}