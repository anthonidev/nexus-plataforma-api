import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UpdateMinimumReconsumptionDto } from './dto/update-reconsumtion.dto';
import { FixService } from './fix.service';

@Controller('fix')
@Roles('ADM', 'SYS')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FixController {
  constructor(private readonly fixService: FixService) {}
  @Put('minimum-reconsumption')
  @ApiOperation({
    summary: 'Actualizar monto mínimo de reconsumo de todas las membresías',
  })
  @ApiResponse({
    status: 200,
    description: 'Membresías actualizadas correctamente',
  })
  updateAllMembershipsMinimumReconsumption(
    @Body() updateDto: UpdateMinimumReconsumptionDto,
  ) {
    return this.fixService.updateAllMembershipsMinimumReconsumption(
      updateDto.minimumReconsumptionAmount,
    );
  }
}
