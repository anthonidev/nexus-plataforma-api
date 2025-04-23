import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { UserModule } from 'src/user/user.module';
import { EcommerceController } from './controllers/ecommerce.controller';
import { ProductCategory } from './entities/product-category.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductStockHistory } from './entities/product-stock-history.entity';
import { Product } from './entities/products.entity';
import { EcommerceService } from './services/ecommerce.service';
import { ProductService } from './services/product.service';
import { ProductController } from './controllers/product.controller';

@Module({
  controllers: [EcommerceController, ProductController],
  providers: [EcommerceService, ProductService],
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductCategory,
      ProductImage,
      ProductStockHistory,
    ]),
    CloudinaryModule,
    UserModule,
  ],
  exports: [TypeOrmModule, EcommerceService],
})
export class EcommerceModule {}
