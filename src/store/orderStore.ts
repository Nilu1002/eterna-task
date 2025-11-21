import { OrderJobData, OrderStatus, StatusUpdate } from '../types/order';

interface StoredOrder {
  job: OrderJobData;
  history: StatusUpdate[];
}

const store = new Map<string, StoredOrder>();

export const orderStore = {
  save(job: OrderJobData) {
    store.set(job.id, { job, history: [] });
  },
  appendStatus(orderId: string, status: OrderStatus, detail?: unknown) {
    const existing = store.get(orderId);
    if (!existing) {
      return undefined;
    }

    const update: StatusUpdate = {
      orderId,
      status,
      detail,
      timestamp: new Date().toISOString(),
    };
    existing.history.push(update);
    return update;
  },
  getHistory(orderId: string) {
    return store.get(orderId)?.history ?? [];
  },
  get(orderId: string) {
    return store.get(orderId);
  },
};

