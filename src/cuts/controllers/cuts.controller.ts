import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CutsService } from '../services/cuts.service';

@Controller('cuts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SYS', 'ADM', 'CLI')
export class CutsController {
  constructor(private readonly cutsService: CutsService) {}

  @Post('execute')
  async executeCut(@Body() body: { code: string }) {
    return this.cutsService.executeCut(body.code);
  }

  @Get('validar-hijos')
  async validarHijos() {
    return this.cutsService.validarHijos();
  }
}
