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
import { Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
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
        private readonly dataSource: DataSource,
        private readonly cloudinaryService: CloudinaryService,
    ) { }

    async createOrder(
        userId: string,
        createOrderDto: CreateOrderDto,
        files: Express.Multer.File[],
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

            // Validar archivos de pago
            if (!files || files.length === 0) {
                throw new BadRequestException(
                    'Se requiere al menos una imagen de comprobante de pago',
                );
            }

            if (
                !createOrderDto.payments ||
                !Array.isArray(createOrderDto.payments) ||
                createOrderDto.payments.length === 0
            ) {
                throw new BadRequestException('Se requieren detalles de pago');
            }

            if (files.length !== createOrderDto.payments.length) {
                throw new BadRequestException(
                    `El número de imágenes (${files.length}) no coincide con el número de detalles de pago (${createOrderDto.payments.length})`,
                );
            }

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

                // Usar el precio de miembro o público según corresponda
                // Para simplificar, usaremos memberPrice siempre
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

            // Verificar que los pagos sumen el total
            if (createOrderDto.payments.length > 1) {
                const totalFromPayments = createOrderDto.payments.reduce(
                    (sum, p) => sum + p.amount,
                    0,
                );
                if (Math.abs(totalFromPayments - createOrderDto.totalAmount) > 0.01) {
                    throw new BadRequestException(
                        `La suma de los montos (${totalFromPayments}) no coincide con el monto total (${createOrderDto.totalAmount})`,
                    );
                }
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
            for (const item of orderItems) {
                const orderDetail = this.orderDetailsRepository.create({
                    order: savedOrder,
                    product: item.product,
                    quantity: item.quantity,
                    price: item.price,
                });
                await queryRunner.manager.save(orderDetail);
            }

            // Crear el historial de la orden
            const orderHistory = this.orderHistoryRepository.create({
                order: savedOrder,
                action: OrderAction.CREATED,
                notes: createOrderDto.notes || 'Orden creada',
                performedBy: { id: userId },
            });

            await queryRunner.manager.save(orderHistory);

            const payment = this.paymentRepository.create({
                user: { id: userId },
                paymentConfig: { id: paymentConfig.id },
                amount: createOrderDto.totalAmount,
                status: PaymentStatus.PENDING,
                relatedEntityType: 'order',
                relatedEntityId: savedOrder.id,
                metadata: {
                    "Total de productos": savedOrder.totalAmount,
                    "Número de productos": savedOrder.totalItems,
                    "Productos": savedOrder.orderDetails.map((item) => ({
                        productId: item.product.id,
                        productName: item.product.name,
                        quantity: item.quantity,
                        price: item.price,
                    })),
                },
            });

            const savedPayment = await queryRunner.manager.save(payment);

            // Validar fileIndex
            for (const payment of createOrderDto.payments) {
                if (
                    payment.fileIndex === undefined ||
                    payment.fileIndex < 0 ||
                    payment.fileIndex >= files.length
                ) {
                    throw new BadRequestException(
                        `El fileIndex ${payment.fileIndex} no es válido. Debe estar entre 0 y ${files.length - 1
                        }`,
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

            // Si hay error en la subida de imágenes, eliminar las que se hayan subido
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