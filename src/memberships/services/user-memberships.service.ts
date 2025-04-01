import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { PaymentImage } from 'src/payments/entities/payment-image.entity';
import { Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { ApproveMembershipSubscriptionDto } from '../dto/approve-membership-subscription.dto';
import { CreateMembershipSubscriptionDto } from '../dto/create-membership-subscription.dto';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { Membership, MembershipStatus } from '../entities/membership.entity';
import {
  MembershipAction,
  MembershipHistory,
} from '../entities/membership_history.entity';

@Injectable()
export class UserMembershipsService {
  private readonly logger = new Logger(UserMembershipsService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipPlan)
    private readonly planRepository: Repository<MembershipPlan>,
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
    private readonly dataSource: DataSource,

    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createSubscription(
    userId: string,
    createDto: CreateMembershipSubscriptionDto,
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

      const plan = await this.planRepository.findOne({
        where: { id: createDto.planId },
      });

      if (!plan) {
        throw new NotFoundException(
          `Plan con ID ${createDto.planId} no encontrado`,
        );
      }

      const existingActiveMembership = await this.membershipRepository.findOne({
        where: {
          user: { id: userId },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      if (existingActiveMembership) {
        throw new ConflictException(
          `El usuario ya tiene una membresía activa (Plan: ${existingActiveMembership.plan.name})`,
        );
      }

      const existingPendingMembership = await this.membershipRepository.findOne(
        {
          where: {
            user: { id: userId },
            status: MembershipStatus.PENDING,
          },
        },
      );

      if (existingPendingMembership) {
        throw new ConflictException(
          'El usuario ya tiene una solicitud de membresía pendiente',
        );
      }

      // Obtener la configuración de pago para membresías
      const paymentConfig = await this.paymentConfigRepository.findOne({
        where: { code: 'MEMBERSHIP_PAYMENT' },
      });

      if (!paymentConfig || !paymentConfig.isActive) {
        throw new BadRequestException(
          'La opción de pago para membresías no está disponible',
        );
      }

      // Validación de archivo y detalles de pago
      if (!files || files.length === 0) {
        throw new BadRequestException(
          'Se requiere al menos una imagen de comprobante de pago',
        );
      }

      if (
        !createDto.payments ||
        !Array.isArray(createDto.payments) ||
        createDto.payments.length === 0
      ) {
        throw new BadRequestException('Se requieren detalles de pago');
      }

      // Validar el monto del pago
      if (
        createDto.totalAmount < plan.price ||
        Math.abs(createDto.totalAmount - plan.price) > 0.01
      ) {
        throw new BadRequestException(
          `El monto del pago (${createDto.totalAmount}) no coincide con el precio del plan (${plan.price})`,
        );
      }

      // Validar que el número de archivos coincide con el número de detalles de pago
      if (files.length !== createDto.payments.length) {
        throw new BadRequestException(
          `El número de imágenes (${files.length}) no coincide con el número de detalles de pago (${createDto.payments.length})`,
        );
      }

      // Si hay múltiples pagos, verificar que la suma coincide con el total
      if (createDto.payments.length > 1) {
        const totalFromPayments = createDto.payments.reduce(
          (sum, p) => sum + p.amount,
          0,
        );
        if (Math.abs(totalFromPayments - createDto.totalAmount) > 0.01) {
          throw new BadRequestException(
            `La suma de los montos (${totalFromPayments}) no coincide con el monto total (${createDto.totalAmount})`,
          );
        }
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // Membresía por 1 año

      const nextReconsumptionDate = new Date();
      nextReconsumptionDate.setDate(nextReconsumptionDate.getDate() + 30);

      const membership = this.membershipRepository.create({
        user: { id: userId },
        plan: { id: plan.id },
        startDate,
        endDate,
        status: MembershipStatus.PENDING, // Pendiente hasta que se apruebe el pago
        paidAmount: createDto.totalAmount,
        paymentReference: createDto.paymentReference,
        minimumReconsumptionAmount: 300, // Valor por defecto
        nextReconsumptionDate,
        accumulatedBinaryPoints: 0,
        autoRenewal: false,
      });

      const savedMembership = await queryRunner.manager.save(membership);

      // Crear el pago
      const payment = this.paymentRepository.create({
        user: { id: userId },
        paymentConfig: { id: paymentConfig.id },
        amount: createDto.totalAmount,
        status: PaymentStatus.PENDING,
        relatedEntityType: 'membership',
        relatedEntityId: savedMembership.id,
        metadata: {
          planId: plan.id,
          planName: plan.name,
        },
      });

      const savedPayment = await queryRunner.manager.save(payment);

      // Procesar y guardar imágenes
      const uploadedImages = [];
      const cloudinaryIds = [];

      // Verificar que todos los fileIndex sean válidos
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

      // Primero subimos todas las imágenes a Cloudinary
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

      // Registrar en el historial
      const membershipHistory = this.membershipHistoryRepository.create({
        membership: { id: savedMembership.id },
        action: MembershipAction.CREATED,
        notes: createDto.notes || 'Solicitud de membresía creada',
        metadata: {
          planId: plan.id,
          planName: plan.name,
          paymentId: savedPayment.id,
          imagesCount: uploadedImages.length,
        },
      });

      await queryRunner.manager.save(membershipHistory);

      await queryRunner.commitTransaction();

      return {
        id: savedMembership.id,
        status: savedMembership.status,
        message:
          'Solicitud de membresía creada exitosamente. Pendiente de aprobación.',
        paymentId: savedPayment.id,
        planName: plan.name,
        amount: createDto.totalAmount,
        uploadedImages,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Si hubo un error después de subir imágenes a Cloudinary, deberíamos eliminarlas
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

      this.logger.error(`Error al crear suscripción: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async approveSubscription(
    adminId: string,
    membershipId: number,
    approveDto: ApproveMembershipSubscriptionDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const admin = await this.userRepository.findOne({
        where: { id: adminId },
        relations: ['role'],
      });

      if (!admin) {
        throw new NotFoundException(
          `Administrador con ID ${adminId} no encontrado`,
        );
      }

      if (!['SYS', 'ADM'].includes(admin.role.code)) {
        throw new UnauthorizedException(
          'No tienes permisos para realizar esta acción',
        );
      }

      const membership = await this.membershipRepository.findOne({
        where: { id: membershipId },
        relations: ['user', 'plan'],
      });

      if (!membership) {
        throw new NotFoundException(
          `Membresía con ID ${membershipId} no encontrada`,
        );
      }

      if (membership.status !== MembershipStatus.PENDING) {
        throw new BadRequestException(
          `La membresía no está pendiente, su estado actual es: ${membership.status}`,
        );
      }

      const payment = await this.paymentRepository.findOne({
        where: {
          relatedEntityType: 'membership',
          relatedEntityId: membershipId,
        },
      });

      if (!payment) {
        throw new NotFoundException(
          `Pago asociado a la membresía ${membershipId} no encontrado`,
        );
      }

      const now = new Date();

      if (approveDto.approved) {
        membership.status = MembershipStatus.ACTIVE;

        payment.status = PaymentStatus.APPROVED;
        payment.reviewedBy = admin;
        payment.reviewedAt = now;
      } else {
        membership.status = MembershipStatus.INACTIVE;

        payment.status = PaymentStatus.REJECTED;
        payment.reviewedBy = admin;
        payment.reviewedAt = now;
        payment.rejectionReason =
          approveDto.rejectionReason ||
          'Solicitud rechazada por el administrador';
      }

      await queryRunner.manager.save(membership);
      await queryRunner.manager.save(payment);

      const membershipHistory = this.membershipHistoryRepository.create({
        membership: { id: membershipId },
        performedBy: { id: adminId },
        action: approveDto.approved
          ? MembershipAction.CREATED
          : MembershipAction.CANCELLED,
        notes:
          approveDto.notes ||
          (approveDto.approved
            ? 'Solicitud de membresía aprobada'
            : `Solicitud de membresía rechazada: ${approveDto.rejectionReason}`),
        metadata: {
          approved: approveDto.approved,
          paymentId: payment.id,
        },
      });

      await queryRunner.manager.save(membershipHistory);

      await queryRunner.commitTransaction();

      return {
        id: membership.id,
        status: membership.status,
        message: approveDto.approved
          ? `Membresía activada exitosamente para el usuario ${membership.user.id}`
          : `Membresía rechazada para el usuario ${membership.user.id}`,
        plan: {
          id: membership.plan.id,
          name: membership.plan.name,
        },
        paymentStatus: payment.status,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al aprobar/rechazar suscripción: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
