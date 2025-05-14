import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserPoints } from "../entities/user_points.entity";
import { Repository } from "typeorm";
import { PaginationDto } from "src/common/dto/paginationDto";
import { PaginationHelper } from "src/common/helpers/pagination.helper";
import { GetUserPointsDto } from '../dto/get-user-points.dto';

@Injectable()
export class UserPointsService {
  constructor(
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
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

    const [items, totalItems] = await queryBuilder.getManyAndCount();
    return PaginationHelper.createPaginatedResponse(
      items,
      totalItems,
      paginationDto,
    );
  }
}