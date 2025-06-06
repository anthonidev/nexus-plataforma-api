import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, In, Repository } from 'typeorm';
import { FindWithdrawalsDto } from '../dto/find-withdrawals.dto';
import { WithdrawalConfig } from '../entities/withdrawal-config.entity';
import { Withdrawal, WithdrawalStatus } from '../entities/withdrawal.entity';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import {
  PointsTransaction,
  PointTransactionStatus,
  PointTransactionType,
} from 'src/points/entities/points_transactions.entity';
import { WithdrawalPoints } from '../entities/wirhdrawal-points.entity';

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(WithdrawalConfig)
    private readonly withdrawalConfigRepository: Repository<WithdrawalConfig>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WithdrawalPoints)
    private readonly withdrawalPointsRepository: Repository<WithdrawalPoints>,
    private readonly dataSource: DataSource,
  ) { }

  async createWithdrawal(
    userId: string,
    createWithdrawalDto: CreateWithdrawalDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const withdrawalInfo = await this.isValidWithdrawalInfo(userId);
      // Verificar disponibilidad de puntos
      const userPoints = await this.isValidUserPoints(userId);
      const amount = createWithdrawalDto.amount;      // Verificar que el monto esté dentro de los límites permitidos
      this.isValidLimits(amount, withdrawalInfo);
      // Verificar que el usuario tenga suficientes puntos
      if (userPoints.availablePoints < amount)
        throw new BadRequestException(
          `No tienes suficientes puntos disponibles. Puntos disponibles: ${userPoints.availablePoints}`,
        );
      // Obtener información bancaria del usuario
      const user = await this.isValidBankInfo(userId);

      // Seleccionar los puntos de transaccion usados para el retiro
      const eligiblePointsTransactions = await this.pointsTransactionRepository.find({
        where: {
          user: { id: userId },
          type: In([PointTransactionType.BINARY_COMMISSION, PointTransactionType.DIRECT_BONUS]),
          status: PointTransactionStatus.COMPLETED,
          isArchived: false,
        },
        order: { createdAt: 'ASC' },
      });

      // Iterar sobre las transacciones y asignar puntos al retiro
      let remainingAmountToWithdraw = createWithdrawalDto.amount;
      const pointsTransactionsToLink: PointsTransaction[] = [];
      let totalWithdrawnFromTransactions = 0;

      for (const transaction of eligiblePointsTransactions) {
        const availableAmountInTransaction =
          transaction.amount - (transaction.pendingAmount || 0) - (transaction.withdrawnAmount || 0);
        if (availableAmountInTransaction <= 0) continue; // Saltar a la siguiente iteración del bucle
        if (remainingAmountToWithdraw <= 0) break; // Ya se alcanzó el monto a retirar

        const amountToDeduct = Math.min(remainingAmountToWithdraw, availableAmountInTransaction);

        transaction.pendingAmount = (transaction.pendingAmount || 0) + amountToDeduct; // Actualizar el monto pendiente
        pointsTransactionsToLink.push(transaction);
        remainingAmountToWithdraw -= amountToDeduct;
        totalWithdrawnFromTransactions += amountToDeduct;
      }
      // 3. Verificar si se cubrió el monto solicitado
      if (remainingAmountToWithdraw > 0)
        throw new BadRequestException(
          `No se pudieron seleccionar suficientes puntos archivados disponibles para el retiro. Faltan: ${remainingAmountToWithdraw}`,
        );

      // Crear la solicitud de retiro
      const withdrawal = this.withdrawalRepository.create({
        user: { id: userId },
        amount,
        status: WithdrawalStatus.PENDING,
        bankName: user.bankInfo.bankName,
        accountNumber: user.bankInfo.accountNumber,
        cci: user.bankInfo.cci,
        metadata: {
          "Creado el": new Date(),
          "Monto solicitado": amount,
          "Puntos disponibles": userPoints.availablePoints,

        },
      });

      const savedWithdrawal = await queryRunner.manager.save(withdrawal);

      // Crear los registros en WithdrawalPoints para vincular el retiro con las transacciones de puntos
      const withdrawalPointsToSave = pointsTransactionsToLink.map(transaction => {
        return this.withdrawalPointsRepository.create({
          withdrawal: savedWithdrawal,
          points: transaction,
          amountUsed: transaction.pendingAmount,
        });
      });
      await queryRunner.manager.save(withdrawalPointsToSave);

      // Registrar la transacción de puntos
      const pointsTransaction = this.pointsTransactionRepository.create({
        user: { id: userId },
        type: PointTransactionType.WITHDRAWAL,
        amount,
        status: PointTransactionStatus.PENDING,
        metadata: {
          "Monto solicitado": amount,
          "Puntos disponibles": userPoints.availablePoints,
          "Fecha de solicitud": new Date(),
        },
      });
      await queryRunner.manager.save(pointsTransaction);

      // Actualizar los puntos disponibles del usuario
      userPoints.availablePoints = Number(userPoints.availablePoints) - amount;
      userPoints.totalWithdrawnPoints = Number(userPoints.totalWithdrawnPoints) + amount;
      await queryRunner.manager.save(userPoints);

      // Guardar las actualizaciones en las transacciones de puntos (amountUsedForWithdrawal)
      await this.pointsTransactionRepository.save(pointsTransactionsToLink);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Solicitud de retiro creada exitosamente',
        withdrawal: {
          id: savedWithdrawal.id,
          amount: savedWithdrawal.amount,
          status: savedWithdrawal.status,
          createdAt: savedWithdrawal.createdAt,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al crear solicitud de retiro: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new BadRequestException('Error al procesar la solicitud de retiro');
    } finally {
      await queryRunner.release();
    }
  }

  async findUserWithdrawals(userId: string, filters: FindWithdrawalsDto) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        order = 'DESC',
      } = filters;

      const queryBuilder = this.withdrawalRepository
        .createQueryBuilder('withdrawal')
        .leftJoin('withdrawal.reviewedBy', 'reviewer')
        .where('withdrawal.user.id = :userId', { userId });

      if (status) {
        queryBuilder.andWhere('withdrawal.status = :status', { status });
      }

      if (startDate) {
        queryBuilder.andWhere('withdrawal.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        queryBuilder.andWhere('withdrawal.createdAt <= :endDate', {
          endDate: endOfDay,
        });
      }

      queryBuilder
        .orderBy('withdrawal.createdAt', order)
        .skip((page - 1) * limit)
        .take(limit);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      return {
        ...PaginationHelper.createPaginatedResponse(items, totalItems, filters),
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener retiros del usuario: ${error.message}`,
      );
      throw error;
    }
  }

  async getWithdrawalInfo(userId: string) {
    try {
      // Obtener la configuración de retiro
      const withdrawalConfig = await this.withdrawalConfigRepository.findOne({
        where: { code: 'WITHDRAWAL', isActive: true },
      });

      if (!withdrawalConfig) {
        return {
          canWithdraw: false,
          reason: 'La configuración de retiros no está disponible',
          config: null,
          availablePoints: 0,
          missingInfo: [],
        };
      }

      // Obtener los puntos disponibles del usuario
      const userPoints = await this.userPointsRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!userPoints) {
        return {
          canWithdraw: false,
          reason: 'No tienes puntos registrados',
          config: this.formatConfigForResponse(withdrawalConfig),
          availablePoints: 0,
          missingInfo: [],
        };
      }

      // Obtener información del usuario
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: [
          'personalInfo',
          'bankInfo',
          'billingInfo',
          'billingInfo.ubigeo',
        ],
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      // Verificar si el usuario tiene la información necesaria
      const missingInfo = [];

      // Verificar documentNumber en PersonalInfo
      if (!user.personalInfo || !user.personalInfo.documentNumber) {
        missingInfo.push({
          field: 'documentNumber',
          message: 'Debes completar tu número de documento en tu perfil',
        });
      }

      // Verificar información bancaria
      if (!user.bankInfo) {
        missingInfo.push({
          field: 'bankInfo',
          message: 'Debes completar tu información bancaria para retiros',
        });
      } else {
        if (!user.bankInfo.bankName) {
          missingInfo.push({
            field: 'bankName',
            message: 'Debes completar el nombre del banco',
          });
        }
        if (!user.bankInfo.accountNumber) {
          missingInfo.push({
            field: 'accountNumber',
            message: 'Debes completar el número de cuenta bancaria',
          });
        }
      }

      // Verificar información de facturación
      if (!user.billingInfo) {
        missingInfo.push({
          field: 'billingInfo',
          message: 'Debes completar tu información de facturación',
        });
      } else {
        if (!user.billingInfo.address) {
          missingInfo.push({
            field: 'billingAddress',
            message: 'Debes completar la dirección de facturación',
          });
        }
        if (!user.billingInfo.ubigeo) {
          missingInfo.push({
            field: 'billingUbigeo',
            message:
              'Debes seleccionar la ubicación para tu dirección de facturación',
          });
        }
      }

      // Si falta información, no se puede hacer retiros
      if (missingInfo.length > 0) {
        return {
          canWithdraw: false,

          reason: 'Falta información necesaria para realizar retiros',
          config: this.formatConfigForResponse(withdrawalConfig),
          availablePoints: userPoints.availablePoints,
          missingInfo,
        };
      }

      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, etc.

      // Verificar si estamos en el horario permitido
      const isWithinHours =
        currentHour >= withdrawalConfig.startHour &&
        currentHour < withdrawalConfig.endHour;

      // Verificar si estamos en un día permitido
      const isWithinDays =
        withdrawalConfig.enabledWeekDays.includes(currentDay);

      // Verificar si el usuario tiene el mínimo de puntos requeridos
      const hasMinimumPoints =
        userPoints.availablePoints >= withdrawalConfig.minimumAmount;

      let canWithdraw = true;
      let reason = '';

      if (!isWithinHours) {
        canWithdraw = false;
        reason = `Los retiros están disponibles de ${withdrawalConfig.startHour}:00 a ${withdrawalConfig.endHour}:00 horas`;
      } else if (!isWithinDays) {
        canWithdraw = false;
        const daysText = this.formatWeekDays(withdrawalConfig.enabledWeekDays);
        reason = `Los retiros están disponibles los siguientes días: ${daysText}`;
      } else if (!hasMinimumPoints) {
        canWithdraw = false;
        reason = `El monto mínimo para retiro es ${withdrawalConfig.minimumAmount}`;
      }

      return {
        canWithdraw,
        backName: user.bankInfo?.bankName || null,
        accountNumber: user.bankInfo?.accountNumber || null,
        cci: user.bankInfo?.cci || null,
        reason: canWithdraw ? 'Puedes realizar un retiro' : reason,
        config: this.formatConfigForResponse(withdrawalConfig),
        availablePoints: userPoints.availablePoints,
        missingInfo: [], // Array vacío si tiene toda la información
      };
    } catch (error) {
      this.logger.error(
        `Error al verificar información de retiro: ${error.message}`,
      );
      throw error;
    }
  }

  private formatConfigForResponse(config: WithdrawalConfig) {
    return {
      minimumAmount: config.minimumAmount,
      maximumAmount: config.maximumAmount,
      startHour: config.startHour,
      endHour: config.endHour,
      enabledWeekDays: config.enabledWeekDays,
    };
  }

  private formatWeekDays(days: number[]): string {
    const dayNames = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
    return days.map((day) => dayNames[day]).join(', ');
  }

  private async isValidWithdrawalInfo(userId: string) {
    const withdrawalInfo = await this.getWithdrawalInfo(userId);
    if (!withdrawalInfo.canWithdraw)
      throw new BadRequestException(withdrawalInfo.reason);

    if (withdrawalInfo.missingInfo && withdrawalInfo.missingInfo.length > 0)
      throw new BadRequestException(
        'Falta información necesaria para realizar retiros: ' +
        withdrawalInfo.missingInfo.map((info) => info.message).join(', '),
      );
    return withdrawalInfo;
  }

  private async isValidUserPoints(userId: string) {
    const userPoints = await this.userPointsRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!userPoints) {
      throw new BadRequestException('No tienes puntos registrados');
    }
    return userPoints;
  }

  private isValidLimits(amount: number, withdrawalInfo: any) {
    if (amount < withdrawalInfo.config.minimumAmount)
      throw new BadRequestException(
        `El monto mínimo para retiro es ${withdrawalInfo.config.minimumAmount}`,
      );

    if (
      withdrawalInfo.config.maximumAmount &&
      amount > withdrawalInfo.config.maximumAmount
    )
      throw new BadRequestException(
        `El monto máximo para retiro es ${withdrawalInfo.config.maximumAmount}`,
      );
  }

  private async isValidBankInfo(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['bankInfo'],
    });

    if (!user)
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);

    if (!user.bankInfo)
      throw new BadRequestException(
        'No tienes información bancaria registrada',
      );
    return user;
  }
}
