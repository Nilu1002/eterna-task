import { EventEmitter } from 'node:events';
import IORedis from 'ioredis';
import { config } from '../config/env';
import { OrderStatus, StatusUpdate } from '../types/order';
import { orderStore } from '../store/orderStore';

type StatusListener = (update: StatusUpdate) => void;

class StatusBus extends EventEmitter {
  private publisher: IORedis;
  private subscriber: IORedis;
  private readonly CHANNEL_PREFIX = 'order:status:';

  constructor() {
    super();
    this.setMaxListeners(0);

    // Create separate connections for pub/sub
    this.publisher = new IORedis(config.redis.url);
    this.subscriber = new IORedis(config.redis.url);

    // Subscribe to all order status updates
    this.subscriber.psubscribe(`${this.CHANNEL_PREFIX}*`, (err) => {
      if (err) {
        console.error('Failed to subscribe to Redis channels:', err);
      }
    });

    // Forward Redis messages to local EventEmitter
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      const orderId = channel.replace(this.CHANNEL_PREFIX, '');
      const update: StatusUpdate = JSON.parse(message);
      super.emit(orderId, update);
    });
  }

  async emitStatus(orderId: string, status: OrderStatus, detail?: unknown) {
    const update = await orderStore.appendStatus(orderId, status, detail);
    if (update) {
      // Publish to Redis so all processes can receive it
      await this.publisher.publish(
        `${this.CHANNEL_PREFIX}${orderId}`,
        JSON.stringify(update)
      );
      // Also emit locally for same-process listeners
      super.emit(orderId, update);
    }
  }

  subscribe(orderId: string, listener: StatusListener) {
    super.on(orderId, listener);
    return () => super.off(orderId, listener);
  }

  async close() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

export const statusBus = new StatusBus();

