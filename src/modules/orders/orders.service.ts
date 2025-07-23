import { Injectable } from '@nestjs/common';

export interface Order {
  id: string;
  userId: string;
  items: string[];
  total: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrdersService {
  private orders: Map<string, Order> = new Map();

  async createOrder(data: any): Promise<Order> {
    const id = `order_${Date.now()}`;
    const order: Order = {
      id,
      userId: data.userId,
      items: data.items,
      total: data.total,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.orders.set(id, order);
    return order;
  }

  async getOrderById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async updateOrder(id: string, data: any): Promise<Order | null> {
    const order = this.orders.get(id);
    if (!order) return null;

    const updatedOrder = {
      ...order,
      ...data,
      updatedAt: new Date()
    };
    
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async deleteOrder(id: string): Promise<boolean> {
    return this.orders.delete(id);
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.userId === userId);
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }
}
