import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CutsService } from '../services/cuts.service';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('cuts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SYS', 'ADM', 'CLI')
export class CutsController {
  constructor(private readonly cutsService: CutsService) {}

  @Post('execute')
  @ApiOperation({ summary: 'Ejecutar corte' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Código del corte a ejecutar',
          example: 'CORTEX1234',
        },
      },
      required: ['code'],
    },
  })
  @ApiResponse({ status: 200, description: 'Ejecución del corte completada' })
  async executeCut(@Body() body: { code: string }) {
    return this.cutsService.executeCut(body.code);
  }

  @Get('validar-hijos')
  @ApiOperation({ summary: 'Validar hijos' })
  @ApiResponse({ status: 200, description: 'Validación de hijos completada' })
  async validarHijos() {
    return this.cutsService.validarHijos();
  }
}
