import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/env';
import { MockDexRouter } from '../dex/mockDexRouter';
import { statusBus } from '../events/statusBus';
import { OrderJobData } from '../types/order';
import { delay } from '../utils/timing';

const connection = new IORedis(config.redis.url);
const router = new MockDexRouter();

export const orderWorker = new Worker<OrderJobData>(
  config.queue.name,
  async (job) => {
    const { id, payload } = job.data;
    try {
      await statusBus.emitStatus(id, 'routing', { message: 'Fetching DEX quotes' });
      const quotes = await router.getQuotes(payload);
      const bestQuote = router.selectBestQuote(quotes);
      await statusBus.emitStatus(id, 'building', {
        chosenDex: bestQuote.dex,
        bestPrice: bestQuote.price,
        feeBps: bestQuote.feeBps,
      });

      await delay(400);
      await statusBus.emitStatus(id, 'submitted', {
        chosenDex: bestQuote.dex,
        note: 'Mock transaction broadcasted',
      });

      const execution = await router.executeSwap(payload, bestQuote);
      await statusBus.emitStatus(id, 'confirmed', execution);

      return execution;
    } catch (error) {
      await statusBus.emitStatus(id, 'failed', {
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },
  {
    connection,
    concurrency: config.queue.concurrency,
  }
);

orderWorker.on('failed', (job, error) => {
  console.error(`Order ${job?.data.id} failed`, error.message);
});

process.on('SIGINT', async () => {
  await orderWorker.close();
  await connection.quit();
  process.exit(0);
});

