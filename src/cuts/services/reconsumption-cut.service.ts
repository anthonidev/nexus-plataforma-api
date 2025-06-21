import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import {
  MembershipAction,
  MembershipHistory,
} from 'src/memberships/entities/membership_history.entity';
import { Order } from 'src/orders/entities/orders.entity';
import { OrderStatus } from 'src/orders/enums/orders-status.enum';
import {
  MethodPayment,
  Payment,
  PaymentStatus,
} from 'src/payments/entities/payment.entity';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { PaymentImage } from 'src/payments/entities/payment-image.entity';
import {
  PointsTransaction,
  PointTransactionStatus,
  PointTransactionType,
} from 'src/points/entities/points_transactions.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { User } from 'src/user/entities/user.entity';
import { TreeVolumeService } from 'src/payments/services/tree-volumen.service';
import { DataSource, Between, Repository, In } from 'typeorm';
import {
  MembershipReconsumption,
  ReconsumptionStatus,
} from 'src/memberships/entities/membership-recosumption.entity';

@Injectable()
export class ReconsumptionCutService {
  private readonly logger = new Logger(ReconsumptionCutService.name);
  private readonly reportRecipients = [
    'softwaretoni21@gmail.com',
    'tonirodriguez110@gmail.com',
  ];

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PaymentConfig)
    private readonly paymentConfigRepository: Repository<PaymentConfig>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentImage)
    private readonly paymentImageRepository: Repository<PaymentImage>,
    @InjectRepository(MembershipReconsumption)
    private readonly reconsumptionRepository: Repository<MembershipReconsumption>,
    private readonly dataSource: DataSource,
    private readonly treeVolumeService: TreeVolumeService,
    private readonly mailService: MailService,
  ) {}

  async processReconsumptions(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    orderReconsumptions: number;
    autoRenewals: number;
    expired: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Iniciando procesamiento de reconsumiciones automáticas');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const memberships = await this.membershipRepository
        .createQueryBuilder('membership')
        .leftJoinAndSelect('membership.user', 'user')
        .leftJoinAndSelect('membership.plan', 'plan')
        .leftJoinAndSelect('user.personalInfo', 'personalInfo')
        .where('membership.status IN (:...statuses)', {
          statuses: [MembershipStatus.ACTIVE, MembershipStatus.EXPIRED],
        })
        .andWhere('membership.endDate <= :today', { today })
        .getMany();
      this.logger.log(
        `Encontradas ${memberships.length} membresías para evaluar`,
      );

      let processed = 0;
      let successful = 0;
      let failed = 0;
      let orderReconsumptions = 0;
      let autoRenewals = 0;
      let expired = 0;

      for (const membership of memberships) {
        try {
          const endDate = new Date(membership.endDate);
          endDate.setHours(0, 0, 0, 0);

          const daysSinceExpiration = Math.floor(
            (today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysSinceExpiration >= 0) {
            const orderResult = await this.evaluateOrderReconsumption(
              membership,
              queryRunner,
            );

            if (orderResult.success) {
              orderReconsumptions++;
              successful++;
              processed++;
              continue;
            }

            if (membership.autoRenewal) {
              const autoRenewalResult = await this.evaluateAutoRenewal(
                membership,
                queryRunner,
              );

              if (autoRenewalResult.success) {
                autoRenewals++;
                successful++;
                processed++;
                continue;
              }
            }

            if (daysSinceExpiration >= 7) {
              await this.expireMembership(membership, queryRunner);
              expired++;
              successful++;
              processed++;
            } else {
              processed++;
              continue;
            }
          }
        } catch (error) {
          this.logger.error(
            `Error procesando membresía ${membership.id}: ${error.message}`,
          );
          failed++;
          processed++;
        }
      }

      await queryRunner.commitTransaction();

      const results = {
        processed,
        successful,
        failed,
        orderReconsumptions,
        autoRenewals,
        expired,
      };

      this.logger.log(`Procesamiento completado: ${JSON.stringify(results)}`);

      return results;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error general en procesamiento de reconsumiciones: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async evaluateOrderReconsumption(
    membership: Membership,
    queryRunner: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const startDateWithGrace = new Date(membership.startDate);
      startDateWithGrace.setDate(startDateWithGrace.getDate() + 7);

      const endDateWithGrace = new Date(membership.endDate);
      endDateWithGrace.setDate(endDateWithGrace.getDate() + 7);

      const orders = await this.orderRepository.find({
        where: {
          user: { id: membership.user.id },
          status: OrderStatus.APPROVED,
          createdAt: Between(startDateWithGrace, endDateWithGrace),
        },
        relations: ['user', 'orderDetails'],
      });

      const totalOrderAmount = orders.reduce(
        (sum, order) => sum + Number(order.totalAmount),
        0,
      );

      if (totalOrderAmount >= 275) {
        await this.processOrderBasedReconsumption(
          membership,
          totalOrderAmount,
          queryRunner,
        );

        return {
          success: true,
          message: `Reconsumo procesado por órdenes: ${totalOrderAmount}`,
        };
      }

      return {
        success: false,
        message: `Monto insuficiente en órdenes: ${totalOrderAmount}`,
      };
    } catch (error) {
      this.logger.error(
        `Error evaluando reconsumo por órdenes: ${error.message}`,
      );
      return { success: false, message: error.message };
    }
  }

  private async evaluateAutoRenewal(
    membership: Membership,
    queryRunner: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: membership.user.id } },
      });

      if (
        !userPoints ||
        userPoints.availablePoints < membership.minimumReconsumptionAmount
      ) {
        return {
          success: false,
          message: `Puntos insuficientes: ${userPoints?.availablePoints || 0}`,
        };
      }

      await this.processAutoRenewal(membership, queryRunner);

      return {
        success: true,
        message: `Auto-renovación procesada con ${membership.minimumReconsumptionAmount} puntos`,
      };
    } catch (error) {
      this.logger.error(`Error en auto-renovación: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  private async processOrderBasedReconsumption(
    membership: Membership,
    totalAmount: number,
    queryRunner: any,
  ): Promise<void> {
    const endDate = new Date(membership.endDate);
    const newStartDate = new Date(endDate);
    newStartDate.setDate(newStartDate.getDate() + 1);

    const newEndDate = new Date(newStartDate);
    newEndDate.setMonth(newEndDate.getMonth() + 1);
    newEndDate.setDate(newEndDate.getDate() - 1);

    membership.startDate = newStartDate;
    membership.endDate = newEndDate;
    // *** AGREGAR ESTA LÍNEA ***
    membership.status = MembershipStatus.ACTIVE;

    await queryRunner.manager.save(membership);

    const reconsumption = this.reconsumptionRepository.create({
      membership: { id: membership.id },
      amount: membership.minimumReconsumptionAmount,
      status: ReconsumptionStatus.ACTIVE,
      periodDate: newEndDate,
      notes: 'Reconsumo automático por órdenes entregadas',
      paymentDetails: {
        type: 'ORDER_BASED',
        totalOrderAmount: totalAmount,
        processedAt: new Date(),
      },
    });

    await queryRunner.manager.save(reconsumption);

    const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.RENEWED,
      notes: `Reconsumo automático por órdenes: ${totalAmount}`,
      changes: {
        'Tipo de reconsumo': 'Basado en órdenes',
        'Monto total de órdenes': totalAmount,
        'Nueva fecha de inicio': newStartDate.toISOString().split('T')[0],
        'Nueva fecha de fin': newEndDate.toISOString().split('T')[0],
        'Status actualizado': 'ACTIVE', // *** AGREGAR ESTA LÍNEA ***
      },
    });

    await queryRunner.manager.save(membershipHistory);

    await this.treeVolumeService.processTreeVolumesReConsumption(
      membership.user,
      totalAmount,
      queryRunner,
      null,
    );
  }

  private async processAutoRenewal(
    membership: Membership,
    queryRunner: any,
  ): Promise<void> {
    const amount = membership.minimumReconsumptionAmount;

    const availableTransactions = await this.pointsTransactionRepository.find({
      where: {
        user: { id: membership.user.id },
        status: PointTransactionStatus.COMPLETED,
        type: In([
          PointTransactionType.BINARY_COMMISSION,
          PointTransactionType.DIRECT_BONUS,
        ]),
      },
      order: { createdAt: 'ASC' },
    });

    let remainingAmount = amount;
    for (const transaction of availableTransactions) {
      if (remainingAmount <= 0) break;

      const availableAmount =
        Number(transaction.amount) - Number(transaction.withdrawnAmount || 0);

      if (availableAmount <= 0) continue;

      const amountToUse = Math.min(availableAmount, remainingAmount);

      transaction.withdrawnAmount =
        Number(transaction.withdrawnAmount || 0) + amountToUse;
      await queryRunner.manager.save(transaction);

      remainingAmount -= amountToUse;
    }

    const userPoints = await this.userPointsRepository.findOne({
      where: { user: { id: membership.user.id } },
    });

    userPoints.availablePoints = userPoints.availablePoints - amount;
    userPoints.totalWithdrawnPoints = userPoints.totalWithdrawnPoints + amount;

    await queryRunner.manager.save(userPoints);

    const pointsTransaction = this.pointsTransactionRepository.create({
      user: { id: membership.user.id },
      amount: amount,
      type: PointTransactionType.WITHDRAWAL,
      status: PointTransactionStatus.COMPLETED,
      metadata: {
        'Tipo de transacción': 'Auto-renovación de membresía',
        'Puntos utilizados': amount,
        'Procesado automáticamente': true,
      },
    });

    await queryRunner.manager.save(pointsTransaction);

    const paymentConfig = await this.paymentConfigRepository.findOne({
      where: { code: 'RECONSUMPTION' },
    });

    const payment = this.paymentRepository.create({
      user: { id: membership.user.id },
      paymentConfig: { id: paymentConfig.id },
      amount: amount,
      status: PaymentStatus.COMPLETED,
      methodPayment: MethodPayment.POINTS,
      relatedEntityType: 'membership_reconsumption',
      reviewedBy: { id: membership.user.id },
      reviewedAt: new Date(),
      metadata: {
        Procesamiento: 'Automático',
        Tipo: 'Auto-renovación',
        'Puntos utilizados': amount,
      },
    });

    const savedPayment = await queryRunner.manager.save(payment);

    const paymentImage = this.paymentImageRepository.create({
      payment: { id: savedPayment.id },
      pointsTransaction: { id: pointsTransaction.id },
      amount: amount,
      transactionReference: `AutoRenewal-${pointsTransaction.id}`,
      bankName: 'Nexus Points',
      transactionDate: new Date(),
      isActive: true,
    });

    await queryRunner.manager.save(paymentImage);

    const newStartDate = new Date(membership.endDate);
    newStartDate.setDate(newStartDate.getDate() + 1);

    const newEndDate = new Date(newStartDate);
    newEndDate.setMonth(newEndDate.getMonth() + 1);
    newEndDate.setDate(newEndDate.getDate() - 1);

    membership.startDate = newStartDate;
    membership.endDate = newEndDate;
    membership.status = MembershipStatus.ACTIVE;
    await queryRunner.manager.save(membership);

    const reconsumption = this.reconsumptionRepository.create({
      membership: { id: membership.id },
      amount: amount,
      status: ReconsumptionStatus.ACTIVE,
      periodDate: newEndDate,
      paymentReference: `AutoRenewal-${savedPayment.id}`,
      notes: 'Auto-renovación automática con puntos',
      paymentDetails: {
        type: 'AUTO_RENEWAL',
        paymentId: savedPayment.id,
        pointsUsed: amount,
        processedAt: new Date(),
      },
    });

    const savedReconsumption = await queryRunner.manager.save(reconsumption);

    savedPayment.relatedEntityId = savedReconsumption.id;
    await queryRunner.manager.save(savedPayment);

    const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.RENEWED,
      notes: `Auto-renovación con ${amount} puntos`,
      changes: {
        'Tipo de reconsumo': 'Auto-renovación',
        'Puntos utilizados': amount,
        'Nueva fecha de inicio': newStartDate.toISOString().split('T')[0],
        'Nueva fecha de fin': newEndDate.toISOString().split('T')[0],
      },
    });

    await queryRunner.manager.save(membershipHistory);

    await this.treeVolumeService.processTreeVolumesReConsumption(
      membership.user,
      amount,
      queryRunner,
      savedPayment,
    );
  }

  private async expireMembership(
    membership: Membership,
    queryRunner: any,
  ): Promise<void> {
    membership.status = MembershipStatus.EXPIRED;
    await queryRunner.manager.save(membership);

    const membershipHistory = this.membershipHistoryRepository.create({
      membership: { id: membership.id },
      action: MembershipAction.STATUS_CHANGED,
      notes: 'Membresía expirada automáticamente después del período de gracia',
      changes: {
        'Estado anterior': 'ACTIVE',
        'Nuevo estado': 'EXPIRED',
        'Fecha de expiración': new Date(membership.endDate)
          .toISOString()
          .split('T')[0],
        'Días de gracia cumplidos': 5,
      },
    });

    await queryRunner.manager.save(membershipHistory);
  }

  private async sendReconsumptionReport(reportData: {
    processed: number;
    successful: number;
    failed: number;
    orderReconsumptions: number;
    autoRenewals: number;
    expired: number;
  }): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const subject = `Reporte de Reconsumiciones Automáticas: ${today}`;

      const successRate =
        reportData.processed > 0
          ? ((reportData.successful / reportData.processed) * 100).toFixed(2)
          : 0;

      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reporte de Reconsumiciones</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; margin-bottom: 20px;">
            <tr>
              <td style="padding: 20px;">
                <h1 style="color: #0a8043; margin: 0; padding: 0; font-size: 24px;">Reporte de Reconsumiciones Automáticas</h1>
                <p style="font-size: 16px; color: #666; margin-top: 5px;">
                  <strong>Fecha:</strong> ${today}
                </p>
              </td>
            </tr>
          </table>
          
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 0 0 20px 0;">
                <h2 style="color: #0a8043; font-size: 18px; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Resumen Ejecutivo
                </h2>
                
                <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td width="33%" style="background-color: #effaf5; border-radius: 4px; padding: 15px;">
                      <p style="font-size: 28px; font-weight: bold; margin: 0; color: #0a8043;">${reportData.processed}</p>
                      <p style="font-size: 14px; margin: 5px 0 0 0; color: #666;">Membresías procesadas</p>
                    </td>
                    <td width="33%" style="background-color: #f8f9fa; border-radius: 4px; padding: 15px;">
                      <p style="font-size: 28px; font-weight: bold; margin: 0; color: #0a8043;">${reportData.successful}</p>
                      <p style="font-size: 14px; margin: 5px 0 0 0; color: #666;">Procesamientos exitosos</p>
                    </td>
                    <td width="33%" style="background-color: #f8f9fa; border-radius: 4px; padding: 15px;">
                      <p style="font-size: 28px; font-weight: bold; margin: 0; color: ${reportData.failed > 0 ? '#dc3545' : '#0a8043'}">${reportData.failed}</p>
                      <p style="font-size: 14px; margin: 5px 0 0 0; color: #666;">Procesamientos fallidos</p>
                    </td>
                  </tr>
                </table>

                <h2 style="color: #0a8043; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Detalle por Tipo de Procesamiento
                </h2>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                  <tr>
                    <td width="33%" style="padding: 0 10px 0 0;">
                      <div style="background-color: #d4edda; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 24px; font-weight: bold; margin: 0; color: #155724;">${reportData.orderReconsumptions}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #155724;">Reconsumos por órdenes</p>
                      </div>
                    </td>
                    <td width="33%" style="padding: 0 10px;">
                      <div style="background-color: #cce7ff; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 24px; font-weight: bold; margin: 0; color: #004085;">${reportData.autoRenewals}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #004085;">Auto-renovaciones</p>
                      </div>
                    </td>
                    <td width="33%" style="padding: 0 0 0 10px;">
                      <div style="background-color: #f8d7da; border-radius: 4px; padding: 15px; height: 100%;">
                        <p style="font-size: 24px; font-weight: bold; margin: 0; color: #721c24;">${reportData.expired}</p>
                        <p style="font-size: 12px; margin: 5px 0 0 0; color: #721c24;">Membresías expiradas</p>
                      </div>
                    </td>
                  </tr>
                </table>
                
                <h2 style="color: #0a8043; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                  Estadísticas del Procesamiento
                </h2>
                <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
                  <tr style="background-color: #effaf5; font-weight: bold;">
                    <th style="text-align: left; padding: 10px; border: 1px solid #dee2e6;">Métrica</th>
                    <th style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">Valor</th>
                  </tr>
                  <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Membresías evaluadas</td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">${reportData.processed}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Tasa de éxito</td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">${successRate}%</td>
                  </tr>
                  <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Reconsumos por órdenes</td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">${reportData.orderReconsumptions}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Auto-renovaciones</td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">${reportData.autoRenewals}</td>
                  </tr>
                  <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #dee2e6;">Membresías expiradas</td>
                    <td style="text-align: right; padding: 10px; border: 1px solid #dee2e6;">${reportData.expired}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; margin-top: 30px;">
            <tr>
              <td style="padding: 20px; text-align: center; color: #6c757d;">
                <p style="font-size: 14px; margin: 0;">
                  Este es un correo automático generado por el sistema de Nexus Platform.<br>
                  Por favor no responda a este correo.
                </p>
                <p style="font-size: 12px; margin: 10px 0 0 0;">
                  © ${new Date().getFullYear()} Nexus Platform. Todos los derechos reservados.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await this.mailService.sendMail({
        to: this.reportRecipients,
        subject,
        html,
      });

      this.logger.log(
        `Reporte de reconsumiciones enviado a: ${this.reportRecipients.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar reporte de reconsumiciones: ${error.message}`,
      );
    }
  }
}
