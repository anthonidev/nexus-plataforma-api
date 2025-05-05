import { Controller, Post } from '@nestjs/common';
import { SeedService } from '../services/seed.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) { }
  @Post()
  @ApiOperation({ summary: 'Ejecuta toda la configuración de seed desde el servicio' })
  @ApiResponse({ status: 200, description: 'Seed ejecutado desde método seedAll del servicio' })
  executeSeed() {
    return this.seedService.seedAll();
  }

  @Post('all')
  @ApiOperation({ summary: 'Ejecuta manualmente cada configuración de seed' })
  @ApiResponse({ status: 200, description: 'Seed ejecutado paso a paso desde el controlador' })
  seedAll() {
    this.seedService.seedUsers();
    this.seedService.seedMembershipPlans();
    this.seedService.seedPaymentConfigs();
    this.seedService.seedWithdrawalConfigs();
    this.seedService.seedRanks();
    this.seedService.seedCutConfigurations();
    return { message: 'All seed data has been executed' };
  }


  @Post('ecommerce-categories')
  @ApiOperation({ summary: 'Generar categorías de productos' })
  @ApiResponse({ status: 200, description: 'Categorías de productos generadas' })
  seedEcommerceCategories() {
    return this.seedService.seedEcommerceCategories();
  }


  @Post('users')
  @ApiOperation({ summary: 'Generar usuarios' })
  @ApiResponse({ status: 200, description: 'Usuarios generados' })
  seedUsers() {
    return this.seedService.seedUsers();
  }

  @Post('membership-plans')
  @ApiOperation({ summary: 'Generar planes de membresía' })
  @ApiResponse({ status: 200, description: 'Planes de membresía generados' })
  seedMembershipPlans() {
    return this.seedService.seedMembershipPlans();
  }

  @Post('payment-configs')
  @ApiOperation({ summary: 'Generar configuraciones de pago' })
  @ApiResponse({ status: 200, description: 'Configuraciones de pago generadas' })
  seedPaymentConfigs() {
    return this.seedService.seedPaymentConfigs();
  }

  @Post('withdrawal-configs')
  @ApiOperation({ summary: 'Generar configuraciones de retiro' })
  @ApiResponse({ status: 200, description: 'Configuraciones de retiro generadas' })
  seedWithdrawalConfigs() {
    return this.seedService.seedWithdrawalConfigs();
  }

  @Post('ranks')
  @ApiOperation({ summary: 'Generar rangos de puntos' })
  @ApiResponse({ status: 200, description: 'Rangos de puntos generados' })
  seedRanks() {
    return this.seedService.seedRanks();
  }

  @Post('cut-configs')
  @ApiOperation({ summary: 'Generar configuraciones de cortes' })
  @ApiResponse({ status: 200, description: 'Configuraciones de cortes generadas' })
  seedCutConfigurations() {
    return this.seedService.seedCutConfigurations();
  }
}
