import { v4 as uuid } from 'uuid';
import { enqueueOrder } from '../queue/orderQueue';
import { CreateOrderDto, OrderJobData } from '../types/order';
import { orderStore } from '../store/orderStore';
import { statusBus } from '../events/statusBus';

export const submitOrder = async (payload: CreateOrderDto) => {
  const orderId = uuid();
  const job: OrderJobData = {
    id: orderId,
    payload: {
      ...payload,
      orderType: 'market',
    },
    createdAt: new Date().toISOString(),
  };

  await orderStore.save(job);
  statusBus.emitStatus(orderId, 'pending', { note: 'Order queued for routing' });
  await enqueueOrder(job);

  return job;
};

export const getOrderHistory = async (orderId: string) => {
  return await orderStore.getHistory(orderId);
};

export const getAllOrders = async () => {
  return await orderStore.getAll();
};

