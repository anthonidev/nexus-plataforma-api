import { Controller } from '@nestjs/common';
import { EcommerceService } from '../services/ecommerce.service';

@Controller('ecommerce')
export class EcommerceController {
  constructor(private readonly ecommerceService: EcommerceService) {}
}
