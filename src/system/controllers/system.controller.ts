import { Body, Controller, Post } from '@nestjs/common';
import { DirectActivationDto } from '../dto/direct-activation.dto';
import { SystemService } from '../services/system.service';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Post()
  activateUserWithPlan(@Body() activationDto: DirectActivationDto) {
    return this.systemService.activateUserWithPlan(
      activationDto.email,
      activationDto.planCode,
    );
  }
  @Post('change-plan')
  changeUserPlan(@Body() changePlanDto: DirectActivationDto) {
    return this.systemService.changeUserPlan(
      changePlanDto.email,
      changePlanDto.planCode,
    );
  }
}
