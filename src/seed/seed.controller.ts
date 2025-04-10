import { Controller, Post } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}
  @Post()
  executeSeed() {
    return this.seedService.seedAll();
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
}
