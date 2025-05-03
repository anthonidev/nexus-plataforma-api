import { Controller, Post } from '@nestjs/common';
import { GlobalAccountsSeedService } from '../services/global-accounts-seed.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('seed')
export class GlobalAccountsController {
  constructor(private readonly globalAccountsSeedService: GlobalAccountsSeedService) {}
  
  @Post('global-accounts')
  @ApiOperation({ summary: 'Generar cuentas globales' })
  @ApiResponse({ status: 200, description: 'Cuentas globales generadas' })
  seedGlobalAccounts() {
    return this.globalAccountsSeedService.seedGlobalAccounts();
  }
}