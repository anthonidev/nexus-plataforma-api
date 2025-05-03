import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/user/entities/user.entity';
import { FindPaymentsDto } from '../dto/find-payments.dto';
import { PaymentsService } from '../services/payments.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener pagos' })
  @ApiResponse({ status: 200, description: 'Listado de pagos' })
  findAll(@Query() filters: FindPaymentsDto, @GetUser() user: User) {
    return this.paymentsService.findAll(filters, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener pago' })
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'Pago solicitado' })
  findOne(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    return this.paymentsService.findOne(id, user.id);
  }
}
