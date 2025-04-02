import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/is-public.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UbigeoService } from '../services/ubigeo.service';
@Controller('ubigeos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UbigeoController {
  constructor(private readonly ubigeoService: UbigeoService) {}
  @Get()
  @Public()
  async findAll() {
    try {
      const ubigeos = await this.ubigeoService.findAll();
      return {
        success: true,
        data: ubigeos,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Error al obtener ubigeos',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
