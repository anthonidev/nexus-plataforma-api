import { Body, Controller, Post } from '@nestjs/common';
import { DirectActivationDto } from '../dto/direct-activation.dto';
import { SystemService } from '../services/system.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdatePasswordDto } from '../dto/update-password.dto';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Post()
  @ApiOperation({ summary: 'Activar usuario con plan' })
  @ApiResponse({ status: 200, description: 'Usuario activado con éxito' })
  activateUserWithPlan(@Body() activationDto: DirectActivationDto) {
    return this.systemService.activateUserWithPlan(
      activationDto.email,
      activationDto.planCode,
    );
  }

  @Post('change-plan')
  @ApiOperation({ summary: 'Cambiar plan de usuario' })
  @ApiResponse({ status: 200, description: 'Plan de usuario cambiado con éxito' })
  changeUserPlan(@Body() changePlanDto: DirectActivationDto) {
    return this.systemService.changeUserPlan(
      changePlanDto.email,
      changePlanDto.planCode,
    );
  }

  @Post('update-password')
  @ApiOperation({ summary: 'Actualizar contraseña de usuario' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada con éxito' })
  updatePassword(@Body() updatePasswordDto: UpdatePasswordDto) {
    return this.systemService.updatePasswordInternal(updatePasswordDto);
  }
}
