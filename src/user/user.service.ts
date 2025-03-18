import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import {
  PaginatedResult,
  PaginationHelper,
} from 'src/common/helpers/pagination.helper';
import { Role } from './entities/roles.entity';
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly SALT_ROUNDS = 10;
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
    const user = await this.userRepository.findOne({
      where: criteria,
      select: [
        'id',
        'username',
        'isActive',
        'createdAt',
        'updatedAt',
        'password',
      ],
      relations,
    });
    if (!user) {
      throw new NotFoundException(`Usuario no encontrado`);
    }
    return user;
  }
  private async validateRoleAndUsername(
    username?: string,
    roleId?: number,
  ): Promise<void> {
    if (username) {
      const existingUser = await this.userRepository.findOne({
        where: { username: username.toLowerCase() },
      });
      if (existingUser) {
        throw new ConflictException('El correo electrónico ya existe');
      }
    }
    if (roleId) {
      const role = await this.roleRepository.findOne({
        where: { id: roleId, isActive: true },
      });
      if (!role) {
        throw new NotFoundException(
          `El rol con ID ${roleId} no existe o no está activo`,
        );
      }
    }
  }
  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error) {
      this.logger.error(`Error hashing password: ${error.message}`);
      throw new InternalServerErrorException('Error al procesar la contraseña');
    }
  }
  // async create(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
  //   //function to create a new user
  // }
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
          'user.username',
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
  async findByUsername(username: string): Promise<User> {
    try {
      return await this.findOneOrFail({ username: username.toLowerCase() }, [
        'role',
      ]);
    } catch (error) {
      this.logger.error(
        `Error fetching user by email ${username}: ${error.message}`,
      );
      throw error;
    }
  }
}
