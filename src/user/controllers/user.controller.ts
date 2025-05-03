import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { PaginatedResult } from 'src/common/helpers/pagination.helper';
import { UserService } from '../services/user.service';
import { User } from '../entities/user.entity';
import { FindUsersDto } from '../dto/find-users.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly usersService: UserService) {}
  // @Post()
  // @Roles('SYS')
  // create(@Body() createUserDto: CreateUserDto) {
  //   return this.usersService.create(createUserDto);
  // }
  @Get()
  @Roles('SYS')
  @ApiOperation({ summary: 'Lista de usuarios' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  async findAll(
    @GetUser() user: User,
    @Query() findUsersDto: FindUsersDto,
  ): Promise<PaginatedResult<User>> {
    return this.usersService.findAll(user.id, findUsersDto);
  }
  @Get('roles')
  @Roles('SYS')
  @ApiOperation({ summary: 'Lista de roles' })
  @ApiResponse({ status: 200, description: 'Lista de roles' })
  allRoles() {
    return this.usersService.allRoles();
  }
}
