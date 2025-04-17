import { Controller, Post } from '@nestjs/common';
import { SeedService } from '../services/seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}
  @Post()
  executeSeed() {
    return this.seedService.seedAll();
  }

  @Post('all')
  seedAll() {
    this.seedService.seedUsers();
    this.seedService.seedMembershipPlans();
    this.seedService.seedPaymentConfigs();
    this.seedService.seedWithdrawalConfigs();
    this.seedService.seedRanks();
    this.seedService.seedCutConfigurations();
    return { message: 'All seed data has been executed' };
  }

  @Post('users')
  seedUsers() {
    return this.seedService.seedUsers();
  }

  @Post('membership-plans')
  seedMembershipPlans() {
    return this.seedService.seedMembershipPlans();
  }

  @Post('payment-configs')
  seedPaymentConfigs() {
    return this.seedService.seedPaymentConfigs();
  }

  @Post('withdrawal-configs')
  seedWithdrawalConfigs() {
    return this.seedService.seedWithdrawalConfigs();
  }

  @Post('ranks')
  seedRanks() {
    return this.seedService.seedRanks();
  }

  @Post('cut-configs')
  seedCutConfigurations() {
    return this.seedService.seedCutConfigurations();
  }
}
