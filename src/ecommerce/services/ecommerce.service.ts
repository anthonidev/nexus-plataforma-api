import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { DataSource, Repository } from 'typeorm';
import { CreateProductDto } from '../dto/create-ecommerce.dto';
import { UpdateImageDto, UpdateProductDto } from '../dto/update-ecommerce.dto';
import { ProductCategory } from '../entities/product-category.entity';
import { ProductImage } from '../entities/product-image.entity';
import {
  ProductStockHistory,
  StockActionType,
} from '../entities/product-stock-history.entity';
import { Product, ProductStatus } from '../entities/products.entity';

@Injectable()
export class EcommerceService {
  private readonly logger = new Logger(EcommerceService.name);

  constructor(
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepository: Repository<ProductCategory>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    @InjectRepository(ProductStockHistory)
    private readonly productStockHistoryRepository: Repository<ProductStockHistory>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly dataSource: DataSource,
  ) {}

  async findAllCategories(includeInactive = false) {
    try {
      const queryBuilder = this.productCategoryRepository
        .createQueryBuilder('category')
        .orderBy('category.order', 'ASC')
        .addOrderBy('category.name', 'ASC');

      if (!includeInactive) {
        queryBuilder.where('category.isActive = :isActive', { isActive: true });
      }

      const categories = await queryBuilder.getMany();

      return {
        success: true,
        categories,
      };
    } catch (error) {
      this.logger.error(`Error fetching categories: ${error.message}`);
      throw error;
    }
  }

  async createProduct(
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
    userId: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (files.length > 5) {
        throw new BadRequestException(
          'No se pueden subir más de 5 imágenes por producto',
        );
      }

      const category = await this.productCategoryRepository.findOne({
        where: { id: createProductDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException(
          `Categoría con ID ${createProductDto.categoryId} no encontrada`,
        );
      }

      const sku = await this.generateSku(category.code, createProductDto.name);

      const product = this.productRepository.create({
        name: createProductDto.name,
        description: createProductDto.description,
        memberPrice: createProductDto.memberPrice,
        publicPrice: createProductDto.publicPrice,
        stock: createProductDto.stock || 0,
        benefits: createProductDto.benefits || [],
        sku,
        category,
        status:
          createProductDto.stock === 0
            ? ProductStatus.OUT_OF_STOCK
            : ProductStatus.ACTIVE,
        isActive: createProductDto.isActive,
      });

      const savedProduct = await queryRunner.manager.save(product);

      const cloudinaryIds = [];
      const savedImages = [];

      for (let i = 0; i < files.length; i++) {
        try {
          const cloudinaryResponse = await this.cloudinaryService.uploadImage(
            files[i],
            'products',
          );

          cloudinaryIds.push(cloudinaryResponse.publicId);

          const productImage = this.productImageRepository.create({
            url: cloudinaryResponse.url,
            cloudinaryPublicId: cloudinaryResponse.publicId,
            isMain: i === 0,
            order: i,
            product: savedProduct,
          });

          const savedImage = await queryRunner.manager.save(productImage);
          savedImages.push(savedImage);
        } catch (error) {
          this.logger.error(`Error al subir imagen: ${error.message}`);
          throw new BadRequestException(
            `Error al subir imagen: ${error.message}`,
          );
        }
      }

      if (createProductDto.stock !== undefined && createProductDto.stock > 0) {
        const stockHistory = this.productStockHistoryRepository.create({
          product: savedProduct,
          actionType: StockActionType.UPDATE,
          previousQuantity: 0,
          newQuantity: createProductDto.stock,
          quantityChanged: createProductDto.stock,
          notes: 'Stock inicial',
          updatedBy: { id: userId },
        });

        await queryRunner.manager.save(stockHistory);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Producto creado exitosamente',
        product: {
          id: savedProduct.id,
          name: savedProduct.name,
          sku: savedProduct.sku,
          stock: savedProduct.stock,
          status: savedProduct.status,
          images: savedImages.map((img) => ({
            id: img.id,
            url: img.url,
            isMain: img.isMain,
          })),
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al crear producto: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateProduct(productId: number, updateProductDto: UpdateProductDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: ['category'],
      });

      if (!product) {
        throw new NotFoundException(
          `Producto con ID ${productId} no encontrado`,
        );
      }

      let category = product.category;
      if (updateProductDto.categoryId) {
        category = await this.productCategoryRepository.findOne({
          where: { id: updateProductDto.categoryId },
        });

        if (!category) {
          throw new NotFoundException(
            `Categoría con ID ${updateProductDto.categoryId} no encontrada`,
          );
        }
      }

      if (updateProductDto.name !== undefined)
        product.name = updateProductDto.name;
      if (updateProductDto.description !== undefined)
        product.description = updateProductDto.description;
      if (updateProductDto.memberPrice !== undefined)
        product.memberPrice = updateProductDto.memberPrice;
      if (updateProductDto.publicPrice !== undefined)
        product.publicPrice = updateProductDto.publicPrice;
      if (updateProductDto.benefits !== undefined)
        product.benefits = updateProductDto.benefits;
      if (updateProductDto.isActive !== undefined)
        product.isActive = updateProductDto.isActive;
      if (category !== product.category) product.category = category;

      const updatedProduct = await queryRunner.manager.save(product);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Producto actualizado exitosamente',
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          sku: updatedProduct.sku,
          stock: updatedProduct.stock,
          status: updatedProduct.status,
          category: {
            id: updatedProduct.category.id,
            name: updatedProduct.category.name,
          },
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al actualizar producto: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }


  async addImageToProduct(
    productId: number,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Debe proporcionar una imagen');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: ['images'],
      });
      if (!product)
        throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
      if (product.images.length >= 5)
        throw new BadRequestException('No se pueden tener más de 5 imágenes por producto');
      const cloudinaryResponse = await this.cloudinaryService.uploadImage(
        file,
        'products',
      );
      const newImage = this.productImageRepository.create({
        url: cloudinaryResponse.url,
        cloudinaryPublicId: cloudinaryResponse.publicId,
        isMain: false,
        order: product.images.length,
        product,
      });
      const savedImage = await queryRunner.manager.save(newImage);
      await queryRunner.commitTransaction();
      return {
        success: true,
        message: 'Imagen agregada exitosamente',
        image: {
          id: savedImage.id,
          url: savedImage.url,
          isMain: savedImage.isMain,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al agregar imagen: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateProductImage(
    productId: number,
    imageId: number,
    updateImageDto: UpdateImageDto,
    file?: Express.Multer.File,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: ['images'],
      });

      if (!product) {
        throw new NotFoundException(
          `Producto con ID ${productId} no encontrado`,
        );
      }

      const image = await this.productImageRepository.findOne({
        where: { id: imageId, product: { id: productId } },
      });

      if (!image) {
        throw new NotFoundException(
          `Imagen con ID ${imageId} no encontrada para el producto`,
        );
      }

      if (file) {
        if (image.cloudinaryPublicId) {
          try {
            await this.cloudinaryService.deleteImage(image.cloudinaryPublicId);
          } catch (error) {
            this.logger.warn(
              `Error al eliminar imagen anterior de Cloudinary: ${error.message}`,
            );
          }
        }

        const cloudinaryResponse = await this.cloudinaryService.uploadImage(
          file,
          'products',
        );

        image.url = cloudinaryResponse.url;
        image.cloudinaryPublicId = cloudinaryResponse.publicId;
      }

      if (updateImageDto.isMain) {
        const otherImages = product.images.filter((img) => img.id !== imageId);
        for (const otherImage of otherImages) {
          otherImage.isMain = false;
          await queryRunner.manager.save(otherImage);
        }
      }

      if (updateImageDto.isMain !== undefined)
        image.isMain = updateImageDto.isMain;
      if (updateImageDto.order !== undefined)
        image.order = updateImageDto.order;

      const updatedImage = await queryRunner.manager.save(image);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Imagen actualizada exitosamente',
        image: {
          id: updatedImage.id,
          url: updatedImage.url,
          isMain: updatedImage.isMain,
          order: updatedImage.order,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al actualizar imagen: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteProductImage(productId: number, imageId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: ['images'],
      });

      if (!product) {
        throw new NotFoundException(
          `Producto con ID ${productId} no encontrado`,
        );
      }

      if (product.images.length <= 1) {
        throw new BadRequestException(
          'No se puede eliminar la única imagen del producto',
        );
      }

      const image = await this.productImageRepository.findOne({
        where: { id: imageId, product: { id: productId } },
      });

      if (!image) {
        throw new NotFoundException(
          `Imagen con ID ${imageId} no encontrada para el producto`,
        );
      }

      if (image.cloudinaryPublicId) {
        try {
          await this.cloudinaryService.deleteImage(image.cloudinaryPublicId);
        } catch (error) {
          this.logger.warn(
            `Error al eliminar imagen de Cloudinary: ${error.message}`,
          );
        }
      }

      if (image.isMain && product.images.length > 1) {
        const nextImage = product.images.find((img) => img.id !== imageId);
        if (nextImage) {
          nextImage.isMain = true;
          await queryRunner.manager.save(nextImage);
        }
      }

      await queryRunner.manager.remove(image);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Imagen eliminada exitosamente',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al eliminar imagen: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async generateSku(
    categoryCode: string,
    productName: string,
  ): Promise<string> {
    const prefix = categoryCode.substring(0, 3).toUpperCase();

    let productPrefix = '';
    const words = productName.trim().split(' ');
    if (words.length > 0) {
      productPrefix = words[0].substring(0, 3).toUpperCase();
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);

    const timestamp = Date.now().toString().slice(-4);

    const sku = `${prefix}-${productPrefix}${randomNum}${timestamp}`;

    const existingProduct = await this.productRepository.findOne({
      where: { sku },
    });

    if (existingProduct) {
      return this.generateSku(categoryCode, productName);
    }

    return sku;
  }
}
