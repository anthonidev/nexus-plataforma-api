import { Product } from "../entities/products.entity";

export const formatProductResponse = (product: Product) => {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    sku: product.sku,
    memberPrice: product.memberPrice,
    publicPrice: product.publicPrice,
    stock: product.stock,
    status: product.status,
    isActive: product.isActive,
    category: product.category ? {
      id: product.category.id,
      name: product.category.name,
      code: product.category.code
    } : null,
    imagesCount: product.images ? product.images.length : 0,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}