import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/env';
import { OrderJobData } from '../types/order';

const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});

export const orderQueue = new Queue<OrderJobData>(config.queue.name, { connection });

export const enqueueOrder = (job: OrderJobData) =>
  orderQueue.add('execute-order', job, {
    attempts: config.queue.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: config.queue.backoffMs,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });

