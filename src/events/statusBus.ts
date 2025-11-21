import { EventEmitter } from 'node:events';
import { OrderStatus, StatusUpdate } from '../types/order';
import { orderStore } from '../store/orderStore';

type StatusListener = (update: StatusUpdate) => void;

class StatusBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }

  async emitStatus(orderId: string, status: OrderStatus, detail?: unknown) {
    const update = await orderStore.appendStatus(orderId, status, detail);
    if (update) {
      super.emit(orderId, update);
    }
  }

  subscribe(orderId: string, listener: StatusListener) {
    super.on(orderId, listener);
    return () => super.off(orderId, listener);
  }
}

export const statusBus = new StatusBus();

