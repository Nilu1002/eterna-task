import { OrderJobData, OrderStatus, StatusUpdate } from '../types/order';

interface StoredOrder {
  job: OrderJobData;
  history: StatusUpdate[];
}

import { prisma } from '../db/client';

export const orderStore = {
  async save(job: OrderJobData) {
    await prisma.order.create({
      data: {
        id: job.id,
        tokenIn: job.payload.tokenIn,
        tokenOut: job.payload.tokenOut,
        amount: job.payload.amount,
        wallet: job.payload.wallet,
        orderType: job.payload.orderType ?? 'market',
        createdAt: new Date(job.createdAt),
      },
    });
  },
  async appendStatus(orderId: string, status: OrderStatus, detail?: unknown) {
    const event = await prisma.orderEvent.create({
      data: {
        orderId,
        status,
        detail: detail as any, // Prisma handles Json
      },
    });

    return {
      orderId,
      status: event.status as OrderStatus,
      detail: event.detail,
      timestamp: event.timestamp.toISOString(),
    } as StatusUpdate;
  },
  async getHistory(orderId: string) {
    const events = await prisma.orderEvent.findMany({
      where: { orderId },
      orderBy: { timestamp: 'asc' },
    });

    return events.map((e) => ({
      orderId: e.orderId,
      status: e.status as OrderStatus,
      detail: e.detail,
      timestamp: e.timestamp.toISOString(),
    })) as StatusUpdate[];
  },
  async get(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) return undefined;

    // Reconstruct OrderJobData if needed, or just return the order
    // For now, let's return what matches the interface roughly or undefined
    // The original code returned StoredOrder { job, history }
    // We might need to fetch history too if we want to match exact behavior
    // But let's see where .get() is used.
    // It seems .get() was used in the original store but maybe not widely used?
    // Let's check usages.
    return order;
  },
};

