import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/dto/paginationDto';
import { PaginationHelper } from 'src/common/helpers/pagination.helper';
import { Repository } from 'typeorm';
import { FindProductsDto } from '../dto/filter-products.dto';
import { ProductStockHistory } from '../entities/product-stock-history.entity';
import { Product } from '../entities/products.entity';
import { formatProductResponse } from '../helpers/format-product-response.helper';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductStockHistory)
    private readonly stockHistoryRepository: Repository<ProductStockHistory>,
  ) { }
  // Methods for endpoints
  // SYS - FAC
  async findAll(findProductsDto: FindProductsDto) {
    try {
      const products = await this.findAllProducts(findProductsDto);
      const { items, totalItems } = products;

      const formattedItems = items.map(product => {
        return {
          ...formatProductResponse(product),
          mainImage: product.images && product.images.length > 0
          ? product.images.find(img => img.isMain)?.url || product.images[0].url
          : null,
        }
      });

      return {
        success: true,
        ...PaginationHelper.createPaginatedResponse(
          formattedItems,
          totalItems,
          findProductsDto
        )
      };
    } catch (error) {
      this.logger.error(`Error al obtener productos: ${error.message}`);
      throw error;
    }
  }
  // SYS - FAC
  async findOne(id: number) {
    try {
      const product = await this.findOneProduct(id);
      const formattedProduct = {
        ...formatProductResponse(product),
        images: product.images?.map((img) => ({
          id: img.id,
          url: img.url,
          isMain: img.isMain,
          order: img.order,
        })),
      };
      return {
        success: true,
        product: formattedProduct,
      };
    } catch (error) {
      this.logger.error(`Error al obtener producto: ${error.message}`);
      throw error;
    }
  }
  // SYS - FAC
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
        ...paginatedResult,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener historial de stock: ${error.message}`,
      );
      throw error;
    }
  }

  // CLIENT
  async findAllWithClients(findProductsDto: FindProductsDto) {
    try {
      if (findProductsDto.isActive === undefined)
        throw new BadRequestException('El listado de productos con clientes requiere que se filtre por productos activos');
      const products = await this.findAllProducts(findProductsDto);
      const { items, totalItems } = products;

      const formattedItems = items.map(product => {
        return {
          ...formatProductResponse(product),
          mainImage: product.images && product.images.length > 0
          ? product.images.find(img => img.isMain)?.url || product.images[0].url
          : null,
        }
      });

      return {
        success: true,
        ...PaginationHelper.createPaginatedResponse(
          formattedItems,
          totalItems,
          findProductsDto
        )
      };
    } catch (error) {
      this.logger.error(`Error al obtener productos: ${error.message}`);
      throw error;
    }
  }

  async findOneWithClients(id: number) {
    try {
      const product = await this.findOneProduct(id, true);
      const formattedProduct = {
        ...formatProductResponse(product),
        images: product.images?.map((img) => ({
          id: img.id,
          url: img.url,
          isMain: img.isMain,
          order: img.order,
        })),
      };
      return {
        success: true,
        product: formattedProduct,
      };
    } catch (error) {
      this.logger.error(`Error al obtener producto: ${error.message}`);
      throw error;
    }
  }

  // Internal helpers methods
  private async findAllProducts(findProductsDto: FindProductsDto) {
    const {
      page = 1,
      limit = 10,
      order = 'DESC',
      name,
      categoryId,
      isActive
    } = findProductsDto;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.images', 'images')
      .orderBy('product.createdAt', order);

    if (name)
      queryBuilder.andWhere('LOWER(product.name) LIKE LOWER(:name)', {
        name: `%${name.toLowerCase()}%`
      });

    if (categoryId) queryBuilder.andWhere('category.id = :categoryId', { categoryId });

    if (isActive !== undefined) queryBuilder.andWhere('product.isActive = :isActive', { isActive });

    queryBuilder
      .skip((page - 1) * limit)
      .take(limit);

    queryBuilder.addOrderBy('images.isMain', 'DESC');
    queryBuilder.addOrderBy('images.order', 'ASC');

    const [items, totalItems] = await queryBuilder.getManyAndCount();

    return {
      items,
      totalItems
    }
  } 

  private async findOneProduct(id: number, isActive?: boolean) {
    const whereCondition = isActive ? { id, isActive } : { id };
    const product = await this.productRepository.findOne({
      where: whereCondition,
      relations: ['category', 'images'],
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    if (product.images) {
      product.images.sort((a, b) => {
        if (a.isMain && !b.isMain) return -1;
        if (!a.isMain && b.isMain) return 1;
        return a.order - b.order;
      });
    }

    return product;
  }
}
