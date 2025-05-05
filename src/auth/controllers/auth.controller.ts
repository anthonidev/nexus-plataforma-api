import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from 'src/user/dto/create-user.dto';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { Public } from '../decorators/is-public.decorator';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registra un usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado correctamente' })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login de un usuario' })
  @ApiResponse({ status: 200, description: 'Credenciales de acceso ingresadas correctamente' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.authService.login(user);
  }
  @Post('refresh')
  @ApiOperation({ summary: 'Actualización de tokens de acceso' })
  @ApiResponse({ status: 200, description: 'Token de acceso actualizado correctamente' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }
}
