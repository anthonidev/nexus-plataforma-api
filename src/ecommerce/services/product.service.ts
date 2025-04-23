import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/products.entity';
import { ProductStockHistory } from '../entities/product-stock-history.entity';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductStockHistory)
    private readonly stockHistoryRepository: Repository<ProductStockHistory>,
  ) {}

  async findOne(id: number) {
    try {
      const product = await this.productRepository.findOne({
        where: { id },
        relations: ['category', 'images'],
      });

      if (!product) {
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      }

      // Ordenar imágenes
      if (product.images) {
        product.images.sort((a, b) => {
          if (a.isMain && !b.isMain) return -1;
          if (!a.isMain && b.isMain) return 1;
          return a.order - b.order;
        });
      }

      return {
        success: true,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          sku: product.sku,
          memberPrice: product.memberPrice,
          publicPrice: product.publicPrice,
          stock: product.stock,
          status: product.status,
          benefits: product.benefits,
          isActive: product.isActive,
          category: {
            id: product.category?.id,
            name: product.category?.name,
            code: product.category?.code,
          },
          images: product.images?.map((img) => ({
            id: img.id,
            url: img.url,
            isMain: img.isMain,
            order: img.order,
          })),
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
      };
    } catch (error) {
      this.logger.error(`Error al obtener producto: ${error.message}`);
      throw error;
    }
  }

  async findStockHistory(productId: number, paginationDto: PaginationDto) {
    try {
      const { page = 1, limit = 10, order = 'DESC' } = paginationDto;

      const product = await this.productRepository.findOne({
        where: { id: productId },
        select: ['id', 'name', 'sku'],
      });

      if (!product) {
        throw new NotFoundException(
          `Producto con ID ${productId} no encontrado`,
        );
      }

      const queryBuilder = this.stockHistoryRepository
        .createQueryBuilder('history')
        .leftJoinAndSelect('history.updatedBy', 'updatedBy')
        .where('history.product.id = :productId', { productId })
        .orderBy('history.createdAt', order)
        .skip((page - 1) * limit)
        .take(limit);

      const [stockHistory, totalItems] = await queryBuilder.getManyAndCount();

      const items = stockHistory.map((history) => ({
        id: history.id,
        actionType: history.actionType,
        previousQuantity: history.previousQuantity,
        newQuantity: history.newQuantity,
        quantityChanged: history.quantityChanged,
        notes: history.notes,
        createdAt: history.createdAt,
        updatedBy: history.updatedBy
          ? {
              id: history.updatedBy.id,
              email: history.updatedBy.email,
            }
          : null,
      }));

      const paginatedResult = PaginationHelper.createPaginatedResponse(
        items,
        totalItems,
        paginationDto,
      );

      return {
        success: true,
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
        },
        ...paginatedResult,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener historial de stock: ${error.message}`,
      );
      throw error;
    }
  }
}
