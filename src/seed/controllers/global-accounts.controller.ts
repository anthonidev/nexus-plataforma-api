import { Controller, Post } from '@nestjs/common';
import { GlobalAccountsSeedService } from '../services/global-accounts-seed.service';

@Controller('seed')
export class GlobalAccountsController {
  constructor(private readonly globalAccountsSeedService: GlobalAccountsSeedService) {}
  
  @Post('global-accounts')
  seedGlobalAccounts() {
    return this.globalAccountsSeedService.seedGlobalAccounts();
  }
}