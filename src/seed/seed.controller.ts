import { Body, Controller, Post } from '@nestjs/common';
import { SeedService } from './seed.service';
import { IsInt } from 'class-validator';
class SeedUsersDto {
  @IsInt()
  count: number = 2000;
}

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}
  @Post()
  executeSeed() {
    return this.seedService.seedAll();
  }

  @Post('users')
  seedUsers(@Body() seedUsersDto: SeedUsersDto) {
    return this.seedService.seedUsers(seedUsersDto.count);
  }

  @Post('membership-plans')
  seedMembershipPlans() {
    return this.seedService.seedMembershipPlans();
  }

  @Post('payment-configs')
  seedPaymentConfigs() {
    return this.seedService.seedPaymentConfigs();
  }

  @Post('ranks')
  seedRanks() {
    return this.seedService.seedRanks();
  }
}
