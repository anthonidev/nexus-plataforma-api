import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { PaginatedResult } from 'src/common/helpers/pagination.helper';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
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
  async findAll(
    @GetUser() user: User,
    @Query() findUsersDto: FindUsersDto,
  ): Promise<PaginatedResult<User>> {
    return this.usersService.findAll(user.id, findUsersDto);
  }

  @Get('roles')
  @Roles('SYS')
  allRoles() {
    return this.usersService.allRoles();
  }
}
