import {
    Body,
    Controller,
    HttpStatus,
    ParseFilePipeBuilder,
    Post,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderCreationService } from '../services/order-creation.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderCreationController {
    constructor(private readonly orderCreationService: OrderCreationService) { }

    @Post('create')
    @Roles('CLI')
    @UseInterceptors(FilesInterceptor('paymentImages', 5))
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: 'Crear una nueva orden' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 200, description: 'Orden creada con éxito' })
    createOrder(
        @GetUser() user,
        @Body() createOrderDto: CreateOrderDto,
        @UploadedFiles(
            new ParseFilePipeBuilder()
                .addFileTypeValidator({
                    fileType: /(jpg|jpeg|png|webp)$/,
                })
                .addMaxSizeValidator({
                    maxSize: 1024 * 1024 * 5, // 5MB max per file
                })
                .build({
                    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                    fileIsRequired: true,
                }),
        )
        files: Array<Express.Multer.File>,
    ) {
        return this.orderCreationService.createOrder(
            user.id,
            createOrderDto,
            files,
        );
    }
}