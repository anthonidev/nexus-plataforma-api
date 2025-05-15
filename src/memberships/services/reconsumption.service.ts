import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { PaymentImage } from 'src/payments/entities/payment-image.entity';
import { MethodPayment, Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, In, Repository } from 'typeorm';
import {
  CreateReconsumptionDto,
  UpdateAutoRenewalDto,
} from '../dto/create-reconsumption.dto';
import {
  MembershipReconsumption,
  ReconsumptionStatus,
} from '../entities/membership-recosumption.entity';
import { Membership, MembershipStatus } from '../entities/membership.entity';
import {
  MembershipAction,
  MembershipHistory,
} from '../entities/membership_history.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { PointsTransaction, PointTransactionStatus, PointTransactionType } from 'src/points/entities/points_transactions.entity';
import { TreeVolumeService } from 'src/payments/services/tree-volumen.service';

@Injectable()
export class ReconsumptionService {
  private readonly logger = new Logger(ReconsumptionService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipReconsumption)
    private readonly reconsumptionRepository: Repository<MembershipReconsumption>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentImage)
    private readonly paymentImageRepository: Repository<PaymentImage>,
    @InjectRepository(PaymentConfig)
    private readonly paymentConfigRepository: Repository<PaymentConfig>,
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
    private readonly treeVolumenService: TreeVolumeService,
  ) {}

  async createReconsumption(
    userId: string,
    createDto: CreateReconsumptionDto,
    files?: Express.Multer.File[], // Ahora opcional
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);

      const membership = await this.membershipRepository.findOne({
        where: { user: { id: userId }, status: MembershipStatus.ACTIVE },
        relations: ['plan'],
      });
      if (!membership) throw new NotFoundException('No se encontró una membresía activa');

      const pendingReconsumption = await this.reconsumptionRepository.findOne({
        where: { membership: { id: membership.id }, status: ReconsumptionStatus.PENDING },
      });
      if (pendingReconsumption) throw new BadRequestException('Ya existe un reconsumo pendiente para esta membresía');

      if (new Date() < membership.nextReconsumptionDate) {
        throw new BadRequestException(
          `Aún no es posible realizar el reconsumo. Próxima fecha disponible: ${membership.nextReconsumptionDate.toISOString().split('T')[0]}`,
        );
      }

      if (createDto.totalAmount < membership.minimumReconsumptionAmount) {
        throw new BadRequestException(`El monto mínimo para reconsumo es ${membership.minimumReconsumptionAmount}`);
      }

      const paymentConfig = await this.paymentConfigRepository.findOne({
        where: { code: 'RECONSUMPTION' },
      });
      if (!paymentConfig || !paymentConfig.isActive) {
        throw new BadRequestException('La opción de pago para reconsumo no está disponible');
      }

      // Validar según método de pago
      if (createDto.methodPayment === MethodPayment.VOUCHER) {
        if (!files || files.length === 0) {
          throw new BadRequestException('Se requiere al menos una imagen de comprobante de pago');
        }
        if (!createDto.payments || !Array.isArray(createDto.payments) || createDto.payments.length === 0) {
          throw new BadRequestException('Se requieren detalles de pago');
        }
        if (files.length !== createDto.payments.length) {
          throw new BadRequestException(
            `El número de imágenes (${files.length}) no coincide con el número de detalles de pago (${createDto.payments.length})`,
          );
        }
        if (createDto.payments.length > 1) {
          const totalFromPayments = createDto.payments.reduce((sum, p) => sum + p.amount, 0);
          if (Math.abs(totalFromPayments - createDto.totalAmount) > 0.01) {
            throw new BadRequestException(
              `La suma de los montos (${totalFromPayments}) no coincide con el monto total (${createDto.totalAmount})`,
            );
          }
        }
      } else if (createDto.methodPayment === MethodPayment.POINTS) {
        // Lógica para pago con puntos (similar a createOrder)
        const availableTransactions = await this.pointsTransactionRepository.find({
          where: {
            user: { id: userId },
            status: PointTransactionStatus.COMPLETED,
            type: In([PointTransactionType.BINARY_COMMISSION, PointTransactionType.DIRECT_BONUS]),
          },
          order: { createdAt: 'ASC' },
        });

        const totalAvailablePoints = availableTransactions.reduce(
          (sum, transaction) => sum + Number(transaction.amount) - Number(transaction.withdrawnAmount || 0),
          0
        );

        if (totalAvailablePoints < createDto.totalAmount) {
          throw new BadRequestException(
            `No hay suficientes puntos disponibles (${totalAvailablePoints}) para cubrir el total del reconsumo (${createDto.totalAmount})`
          );
        }

        let remainingAmount = createDto.totalAmount;
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

        if (remainingAmount > 0) {
          throw new BadRequestException(
            `No se pudieron seleccionar suficientes transacciones de puntos para cubrir el monto total del reconsumo.`
          );
        }

    // No necesitas validar files ni createDto.payments aquí
      } else {
        throw new BadRequestException('Método de pago no soportado');
      }

      const periodDate = new Date();
      periodDate.setDate(periodDate.getDate() + 30);

      const reconsumption = this.reconsumptionRepository.create({
        membership: { id: membership.id },
        amount: createDto.totalAmount,
        status: ReconsumptionStatus.PENDING,
        periodDate,
        paymentReference: createDto.paymentReference,
        notes: createDto.notes || 'Reconsumo mensual',
      });
      const savedReconsumption = await queryRunner.manager.save(reconsumption);

      const payment = this.paymentRepository.create({
        user: { id: userId },
        paymentConfig: { id: paymentConfig.id },
        amount: createDto.totalAmount,
        status: PaymentStatus.PENDING,
        relatedEntityType: 'membership_reconsumption',
        relatedEntityId: savedReconsumption.id,
        methodPayment: createDto.methodPayment, // Guardar el método de pago
        metadata: {
            "Monto de pago": createDto.totalAmount,
            "Concepto": "Reconsumo mensual",
        },
      });
      const savedPayment = await queryRunner.manager.save(payment);

      if (createDto.methodPayment === MethodPayment.VOUCHER) {
        const uploadedImages = [];
        const cloudinaryIds = [];
        const cloudinaryUploads = [];

        for (const payment of createDto.payments) {
          if (
            payment.fileIndex === undefined ||
            payment.fileIndex < 0 ||
            payment.fileIndex >= files.length
          ) {
            throw new BadRequestException(
              `El fileIndex ${payment.fileIndex} no es válido. Debe estar entre 0 y ${files.length - 1}`,
            );
          }
        }
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
        for (const paymentDetail of createDto.payments) {
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

        const membershipHistory = this.membershipHistoryRepository.create({
          membership: { id: membership.id },
          action: MembershipAction.PAYMENT_RECEIVED,
          notes: createDto.notes || 'Reconsumo mensual registrado',
          metadata: {
            reconsumptionId: savedReconsumption.id,
            paymentId: savedPayment.id,
            amount: createDto.totalAmount,
            imagesCount: uploadedImages.length,
            paymentMethod: MethodPayment.VOUCHER,
          },
        });
        await queryRunner.manager.save(membershipHistory);
      } else if (createDto.methodPayment === MethodPayment.POINTS) {
        // Lógica para pago con puntos (similar a createOrder)
        const availableTransactions = await this.pointsTransactionRepository.find({
          where: {
            user: { id: userId },
            status: PointTransactionStatus.COMPLETED,
            type: In([PointTransactionType.BINARY_COMMISSION, PointTransactionType.DIRECT_BONUS]),
          },
          order: { createdAt: 'ASC' },
        });

        const totalAvailablePoints = availableTransactions.reduce(
          (sum, transaction) => sum + Number(transaction.amount) - Number(transaction.withdrawnAmount || 0),
          0
        );

        if (totalAvailablePoints < createDto.totalAmount) {
          throw new BadRequestException(
            `No hay suficientes puntos disponibles (${totalAvailablePoints}) para cubrir el total del reconsumo (${createDto.totalAmount})`
          );
        }

        let remainingAmount = createDto.totalAmount;
        const selectedTransactions = []; // Declaración aquí

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

        if (remainingAmount > 0) {
          throw new BadRequestException(
            `No se pudieron seleccionar suficientes transacciones de puntos para cubrir el monto total del reconsumo.`
          );
        }

        // Lógica para crear paymentImage y actualizar puntos
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

          transaction.withdrawnAmount = (Number(transaction.withdrawnAmount || 0) + amountToUse);
          await queryRunner.manager.save(transaction);
        }

        savedPayment.status = PaymentStatus.APPROVED;
        savedPayment.reviewedBy = user;
        savedPayment.metadata = {
          ...savedPayment.metadata,
          "Puntos utilizados": createDto.totalAmount,
        };
        await queryRunner.manager.save(savedPayment);

        const pointsTransaction = this.pointsTransactionRepository.create({
          user: { id: userId },
          amount: createDto.totalAmount,
          type: PointTransactionType.WITHDRAWAL,
          status: PointTransactionStatus.COMPLETED,
          metadata: {
            "Tipo de transacción": PointTransactionType.WITHDRAWAL,
            "Puntos utilizados": createDto.totalAmount,
          }
        });
        await queryRunner.manager.save(pointsTransaction);

        const userPoints = await this.userPointsRepository.findOne({ where: { user: { id: userId } } });
        if (!userPoints) throw new NotFoundException(`No hay puntos para el usuario ${userId}`);
        userPoints.availablePoints = userPoints.availablePoints - createDto.totalAmount;
        userPoints.totalWithdrawnPoints = userPoints.totalWithdrawnPoints + createDto.totalAmount;
        await queryRunner.manager.save(userPoints);

        savedReconsumption.status = ReconsumptionStatus.ACTIVE;

        // Actualizar fechas de inicio y fin de la membresía
        const today = new Date();
        membership.startDate = today;
        membership.endDate = periodDate;
        membership.nextReconsumptionDate = periodDate;
        await queryRunner.manager.save(membership);

        const membershipHistory = this.membershipHistoryRepository.create({
          membership: { id: membership.id },
          action: MembershipAction.PAYMENT_RECEIVED,
          notes: `Reconsumo pagado con ${createDto.totalAmount} puntos`,
          metadata: {
            reconsumptionId: savedReconsumption.id,
            paymentId: savedPayment.id,
            amount: createDto.totalAmount,
            paymentMethod: MethodPayment.POINTS,
          },
        });
        await queryRunner.manager.save(membershipHistory);
        
        await queryRunner.manager.save(savedReconsumption);
        await queryRunner.manager.save(savedPayment);

        const { plan } = membership;
        if (!plan) throw new NotFoundException(`Plan de membresía no encontrado`);

        await this.treeVolumenService.processTreeVolumes(user, plan, queryRunner, savedPayment);
        
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Solicitud de reconsumo creada exitosamente. Pago ${createDto.methodPayment === MethodPayment.POINTS ? 'aprobado' : 'pendiente de aprobación'}.`,
        reconsumption: {
          id: savedReconsumption.id,
          amount: savedReconsumption.amount,
          status: savedReconsumption.status,
          periodDate: savedReconsumption.periodDate,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error.cloudinaryIds && Array.isArray(error.cloudinaryIds)) {
        for (const publicId of error.cloudinaryIds) {
          try {
            await this.cloudinaryService.deleteImage(publicId);
            this.logger.log(`Imagen eliminada de Cloudinary: ${publicId}`);
          } catch (deleteErr) {
            this.logger.error(`Error al eliminar imagen de Cloudinary: ${deleteErr.message}`);
          }
        }
      }
      this.logger.error(`Error al crear reconsumo: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  } 

  async updateAutoRenewal(userId: string, updateDto: UpdateAutoRenewalDto) {
    try {
      const membership = await this.membershipRepository.findOne({
      where: {
        user: { id: userId },
        status: MembershipStatus.ACTIVE,
      },
      });

      if (!membership) {
      throw new NotFoundException('No se encontró una membresía activa');
      }

      // Actualizar el valor de autoRenewal
      membership.autoRenewal = updateDto.autoRenewal;
      await this.membershipRepository.save(membership);

      // Registrar en el historial
      const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.STATUS_CHANGED,
      notes: `Auto renovación ${updateDto.autoRenewal ? 'activada' : 'desactivada'}`,
      changes: {
        field: 'autoRenewal',
        oldValue: !updateDto.autoRenewal,
        newValue: updateDto.autoRenewal,
      },
      });

      await this.membershipHistoryRepository.save(membershipHistory);

      return {
      success: true,
      message: `Auto renovación ${updateDto.autoRenewal ? 'activada' : 'desactivada'} exitosamente`,
      membership: {
        id: membership.id,
        autoRenewal: membership.autoRenewal,
      },
      };
    } catch (error) {
      this.logger.error(
      `Error al actualizar auto renovación: ${error.message}`,
      );
      throw error;
    }
  }
}
