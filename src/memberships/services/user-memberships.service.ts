import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { PaymentImage } from 'src/payments/entities/payment-image.entity';
import { Payment, PaymentStatus } from 'src/payments/entities/payment.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateMembershipSubscriptionDto } from '../dto/create-membership-subscription.dto';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { Membership, MembershipStatus } from '../entities/membership.entity';
import {
  MembershipAction,
  MembershipHistory,
} from '../entities/membership_history.entity';
import {
  MembershipUpgrade,
  UpgradeStatus,
} from '../entities/membership_upgrades.entity';

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

      const paymentConfig = await this.paymentConfigRepository.findOne({
        where: { code: 'MEMBERSHIP_PAYMENT' },
      });

      if (!paymentConfig || !paymentConfig.isActive) {
        throw new BadRequestException(
          'La opción de pago para membresías no está disponible',
        );
      }

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

      if (
        createDto.totalAmount < plan.price ||
        Math.abs(createDto.totalAmount - plan.price) > 0.01
      ) {
        throw new BadRequestException(
          `El monto del pago (${createDto.totalAmount}) no coincide con el precio del plan (${plan.price})`,
        );
      }

      if (files.length !== createDto.payments.length) {
        throw new BadRequestException(
          `El número de imágenes (${files.length}) no coincide con el número de detalles de pago (${createDto.payments.length})`,
        );
      }

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
      endDate.setFullYear(endDate.getFullYear() + 1);

      const nextReconsumptionDate = new Date();
      nextReconsumptionDate.setDate(nextReconsumptionDate.getDate() + 30);

      const membership = this.membershipRepository.create({
        user: { id: userId },
        plan: { id: plan.id },
        startDate,
        endDate,
        status: MembershipStatus.PENDING,
        paidAmount: createDto.totalAmount,
        paymentReference: createDto.paymentReference,
        nextReconsumptionDate,
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

      const uploadedImages = [];
      const cloudinaryIds = [];

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
        success: true,
        message:
          'Solicitud de membresía creada exitosamente. Pendiente de aprobación.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

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
      return {
        success: false,
        message: `Error al crear suscripción: ${error.message}`,
      };
    } finally {
      await queryRunner.release();
    }
  }

  async updateMembership(
    userId: string,
    updateDto: CreateMembershipSubscriptionDto,
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

      const currentMembership = await this.membershipRepository.findOne({
        where: {
          user: { id: userId },
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      if (!currentMembership) {
        throw new BadRequestException(
          'No tienes una membresía activa para actualizar',
        );
      }

      const newPlan = await this.planRepository.findOne({
        where: { id: updateDto.planId },
      });

      if (!newPlan) {
        throw new NotFoundException(
          `Plan con ID ${updateDto.planId} no encontrado`,
        );
      }

      if (Number(newPlan.price) <= Number(currentMembership.plan.price)) {
        throw new BadRequestException(
          `Solo puedes actualizar a un plan de mayor valor. El plan seleccionado (${newPlan.name}) tiene un precio igual o menor al actual (${currentMembership.plan.name})`,
        );
      }

      const upgradeCost = newPlan.price - currentMembership.plan.price;

      if (Math.abs(updateDto.totalAmount - upgradeCost) > 0.01) {
        throw new BadRequestException(
          `El monto del pago (${updateDto.totalAmount}) no coincide con el costo de actualización (${upgradeCost})`,
        );
      }

      const paymentConfig = await this.paymentConfigRepository.findOne({
        where: { code: 'PLAN_UPGRADE' },
      });

      if (!paymentConfig || !paymentConfig.isActive) {
        throw new BadRequestException(
          'La opción de pago para actualización de planes no está disponible',
        );
      }

      if (!files || files.length === 0) {
        throw new BadRequestException(
          'Se requiere al menos una imagen de comprobante de pago',
        );
      }

      if (
        !updateDto.payments ||
        !Array.isArray(updateDto.payments) ||
        updateDto.payments.length === 0
      ) {
        throw new BadRequestException('Se requieren detalles de pago');
      }

      if (files.length !== updateDto.payments.length) {
        throw new BadRequestException(
          `El número de imágenes (${files.length}) no coincide con el número de detalles de pago (${updateDto.payments.length})`,
        );
      }

      if (updateDto.payments.length > 1) {
        const totalFromPayments = updateDto.payments.reduce(
          (sum, p) => sum + p.amount,
          0,
        );
        if (Math.abs(totalFromPayments - updateDto.totalAmount) > 0.01) {
          throw new BadRequestException(
            `La suma de los montos (${totalFromPayments}) no coincide con el monto total (${updateDto.totalAmount})`,
          );
        }
      }

      const membershipUpgrade = queryRunner.manager.create(MembershipUpgrade, {
        membership: { id: currentMembership.id },
        fromPlan: { id: currentMembership.plan.id },
        toPlan: { id: newPlan.id },
        status: UpgradeStatus.PENDING,
        upgradeCost,
        paymentReference: updateDto.paymentReference,
        notes: updateDto.notes || 'Solicitud de actualización de membresía',
      });

      const savedUpgrade = await queryRunner.manager.save(membershipUpgrade);

      const payment = queryRunner.manager.create(Payment, {
        user: { id: userId },
        paymentConfig: { id: paymentConfig.id },
        amount: upgradeCost,
        status: PaymentStatus.PENDING,
        relatedEntityType: 'membership_upgrade',
        relatedEntityId: savedUpgrade.id,
        metadata: {
          membershipId: currentMembership.id,
          fromPlanId: currentMembership.plan.id,
          fromPlanName: currentMembership.plan.name,
          toPlanId: newPlan.id,
          toPlanName: newPlan.name,
        },
      });

      const savedPayment = await queryRunner.manager.save(payment);

      const uploadedImages = [];
      const cloudinaryIds = [];

      for (const payment of updateDto.payments) {
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

      for (const paymentDetail of updateDto.payments) {
        const fileIndex = paymentDetail.fileIndex;
        const cloudinaryResponse = cloudinaryUploads[fileIndex];

        const paymentImage = queryRunner.manager.create(PaymentImage, {
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

      const membershipHistory = queryRunner.manager.create(MembershipHistory, {
        membership: { id: currentMembership.id },
        action: MembershipAction.UPGRADED,
        notes: updateDto.notes || 'Solicitud de actualización de membresía',
        changes: {
          fromPlanId: currentMembership.plan.id,
          fromPlanName: currentMembership.plan.name,
          toPlanId: newPlan.id,
          toPlanName: newPlan.name,
          upgradeCost,
        },
        metadata: {
          upgradeId: savedUpgrade.id,
          paymentId: savedPayment.id,
          imagesCount: uploadedImages.length,
        },
      });

      await queryRunner.manager.save(membershipHistory);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message:
          'Solicitud de actualización de membresía creada exitosamente. Pendiente de aprobación.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

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

      this.logger.error(`Error al actualizar membresía: ${error.message}`);
      return {
        success: false,
        message: `Error al actualizar membresía: ${error.message}`,
      };
    } finally {
      await queryRunner.release();
    }
  }
}
