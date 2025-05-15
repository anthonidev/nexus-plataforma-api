import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserPoints } from "../entities/user_points.entity";
import { Repository } from "typeorm";
import { PaginationDto } from "src/common/dto/paginationDto";
import { PaginationHelper } from "src/common/helpers/pagination.helper";
import { GetUserPointsDto } from '../dto/get-user-points.dto';
import { FindPointsTransactionDto } from "../dto/find-weekly-volume.dto";
import { PointsTransaction } from "../entities/points_transactions.entity";
import { User } from "src/user/entities/user.entity";
import { PointsTransactionPayment } from "../entities/points-transactions-payments.entity";
import { format } from "path";
import { formatUserResponse } from "../helpers/format-user-response.helper";

@Injectable()
export class UserPointsService {
  private readonly logger = new Logger(UserPointsService.name);
  constructor(
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}
  async getUserPoints(
    getUserPointsDto: GetUserPointsDto,
  ) {
    const { page = 1, limit = 10 } = getUserPointsDto;
    const paginationDto = { page, limit };
    const queryBuilder = this.userPointsRepository
      .createQueryBuilder('userPoints')
      .leftJoinAndSelect('userPoints.user', 'user')
      .leftJoinAndSelect('user.personalInfo', 'personalInfo')
      .leftJoinAndSelect('userPoints.membershipPlan', 'membershipPlan')
      .orderBy('userPoints.availablePoints', 'DESC');
    
    // Term que sea filtro para buscar por nombre, apellido, email, documentoNumber.
    if (getUserPointsDto.term)
      queryBuilder.where(
        `user.email LIKE :term
        OR personalInfo.firstName LIKE :term
        OR personalInfo.lastName LIKE :term
        OR personalInfo.documentNumber LIKE :term`,
        {
          term: `%${getUserPointsDto.term}%`,
        },
      );

    queryBuilder
      .skip((page - 1) * limit)
      .take(limit);

    const [items, totalItems] = await queryBuilder.getManyAndCount();
    const dataUsersPoints = items.map( item => {
      return {
        ...item,
        user: formatUserResponse(item.user),
        membershipPlan: {
          planName: item.membershipPlan.name,
        },
      }
    });
    return PaginationHelper.createPaginatedResponse(
      dataUsersPoints,
      totalItems,
      paginationDto,
    );
  }

  async getUserPointsTransactions(
    userId: string,
    filters: FindPointsTransactionDto,
  ) {
    try {
      const { page = 1, limit = 10 } = filters;
      const queryBuilder = this.pointsTransactionRepository
        .createQueryBuilder('transaction')
        .leftJoin('transaction.user', 'user')
        .where('user.id = :userId', { userId });

      if (filters.type)
        queryBuilder.andWhere('transaction.type = :type', { type: filters.type });
      if (filters.status)
        queryBuilder.andWhere('transaction.status = :status', { status: filters.status });
      if (filters.startDate)
        queryBuilder.andWhere('transaction.createdAt >= :startDate', {
          startDate: new Date(filters.startDate),
        });
      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        queryBuilder.andWhere('transaction.createdAt <= :endDate', {
          endDate: endOfDay,
        });
      }

      queryBuilder
        .orderBy('transaction.createdAt', filters.order)
        .skip((page - 1) * limit)
        .take(limit);

      const [items, totalItems] = await queryBuilder.getManyAndCount();

      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['personalInfo'],
      });

      return {
        user: formatUserResponse(user),
        transactions: PaginationHelper.createPaginatedResponse(
          items,
          totalItems,
          filters,
        )
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener transacciones de puntos: ${error.message}`,
      );
      throw error;
    }
  }

  async getUserPointsTransactionPayments(
    id: number,
    userId: string,
    paginationDto: PaginationDto,
  ) {
      try {
        const getPointsTransactionDetails = await this.pointsTransactionRepository.findOne({
          where: { id, user: { id: userId } },
          relations: [
            'pointsTransactionsPayments',
            'pointsTransactionsPayments.payment',
          ],
        });
        if (!getPointsTransactionDetails)
          throw new NotFoundException(`Transacción de puntos con ID ${id} no encontrada`);
        const { pointsTransactionsPayments, ...restData } =getPointsTransactionDetails;
        const pointsTransactionsPaymentsDetails = await this.paymentDetails(pointsTransactionsPayments);
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['personalInfo'],
          });
        return {
          ...restData,
          listPayments: PaginationHelper.createPaginatedResponse(
            pointsTransactionsPaymentsDetails,
            pointsTransactionsPaymentsDetails.length,
            paginationDto,
          ),
          user: formatUserResponse(user),
        }
      } catch (error) {
        this.logger.error(
          `Error al obtener los pagos de la transacción de puntos: ${error.message}`,
        );
        throw error;
      }
  }

  private async paymentDetails(
      entity: PointsTransactionPayment[]
    ) {
      return entity.map(item => {
        const { payment, ...restData } = item;
        return {
          ...restData,
          payment: {
            id: payment.id,
            amount: payment.amount,
            methodPayment: payment.methodPayment,
            codeOperation: payment.codeOperation,
            banckName: payment.banckName,
            dateOperation: payment.dateOperation,
            numberTicket: payment.numberTicket,
            status: payment.status, 
          },
        };
      });
    }
}