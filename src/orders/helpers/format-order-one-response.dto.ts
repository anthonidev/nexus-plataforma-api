import { Order } from "../entities/orders.entity";

export const formatOrderOneResponse = (order: Order) => {
  return {
    id: order.id,
    userId: order.user.id,
    status: order.status,
    totalAmount: order.totalAmount,
    totalItems: order.totalItems,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    orderDetails: order.orderDetails.map((detail) => ({
      id: detail.id,
      productId: detail.product.id,
      productName: detail.product.name,
      quantity: detail.quantity,
    })),
    orderHistory: order.orderHistory,
  };
};