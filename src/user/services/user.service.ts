import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PaginatedResult,
  PaginationHelper,
} from 'src/common/helpers/pagination.helper';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/roles.entity';
import { FindUsersDto } from '../dto/find-users.dto';
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}
  private async findOneOrFail(
    criteria: FindOptionsWhere<User>,
    relations: string[] = [],
  ): Promise<User> {
    // Relaciones por defecto si no se especifican
    const defaultRelations = [
      'role',
      'personalInfo',
      'contactInfo',
      'billingInfo',
      'bankInfo',
      'leftChild',
      'rightChild',
      'parent',
    ];

    // Usar las relaciones proporcionadas o las predeterminadas si no se especifican
    const finalRelations = relations.length > 0 ? relations : defaultRelations;

    // Buscar el usuario con todas sus relaciones
    const user = await this.userRepository.findOne({
      where: criteria,
      select: ['id', 'email', 'password', 'isActive', 'createdAt', 'updatedAt'],
      relations: finalRelations,
    });

    if (!user) {
      throw new NotFoundException(`Usuario no encontrado`);
    }

    return user;
  }

  async allRoles(): Promise<Role[]> {
    try {
      return await this.roleRepository.find({
        where: { isActive: true },
        select: ['id', 'code', 'name'],
        cache: true,
      });
    } catch (error) {
      this.logger.error(`Error fetching roles: ${error.message}`);
      throw new InternalServerErrorException('Error al obtener los roles');
    }
  }
  async findAll(
    currentUserId: string,
    filters: FindUsersDto,
  ): Promise<PaginatedResult<User>> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        isActive,
        order = 'DESC',
      } = filters;
      const queryBuilder = this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where('user.id != :currentUserId', { currentUserId });
      if (typeof isActive === 'boolean') {
        queryBuilder.andWhere('user.isActive = :isActive', { isActive });
      }
      if (search?.trim()) {
        const searchTerm = search.toLowerCase().trim();
        queryBuilder.andWhere(
          '(LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search OR user.document LIKE :search)',
          { search: `%${searchTerm}%` },
        );
      }
      queryBuilder
        .orderBy('user.updatedAt', order)
        .addOrderBy('user.createdAt', order)
        .skip((page - 1) * limit)
        .take(limit)
        .select([
          'user.id',
          'user.email',
          'user.password',
          'user.isActive',
          'user.createdAt',
          'user.updatedAt',
          'role.id',
          'role.code',
          'role.name',
        ]);
      const [items, totalItems] = await queryBuilder.getManyAndCount();
      return PaginationHelper.createPaginatedResponse(
        items,
        totalItems,
        filters,
      );
    } catch (error) {
      this.logger.error(`Error fetching users: ${error.message}`);
      throw new InternalServerErrorException('Error al obtener los usuarios');
    }
  }
  async findOne(id: string): Promise<User> {
    try {
      return await this.findOneOrFail({ id }, ['role']);
    } catch (error) {
      this.logger.error(`Error fetching user ${id}: ${error.message}`);
      throw error;
    }
  }
  async findByEmail(email: string): Promise<User> {
    try {
      return await this.findOneOrFail({ email: email.toLowerCase() }, ['role']);
    } catch (error) {
      this.logger.error(
        `Error fetching user by email ${email}: ${error.message}`,
      );
      throw error;
    }
  }
}
