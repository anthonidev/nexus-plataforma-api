import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '../../auth/decorators/is-public.decorator';
import { UbigeoService } from '../services/ubigeo.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
@Controller('ubigeos')
export class UbigeoController {
  constructor(private readonly ubigeoService: UbigeoService) {}
  @Public()
  @Get()
  @ApiOperation({ summary: 'Obtener ubigeos' })
  @ApiResponse({ status: 200, description: 'Ubigeos' })
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
