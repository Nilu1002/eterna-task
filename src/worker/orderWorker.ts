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
      statusBus.emitStatus(id, 'routing', { message: 'Fetching DEX quotes' });
      const quotes = await router.getQuotes(payload);
      const bestQuote = router.selectBestQuote(quotes);
      statusBus.emitStatus(id, 'building', {
        chosenDex: bestQuote.dex,
        bestPrice: bestQuote.price,
        feeBps: bestQuote.feeBps,
      });

      await delay(400);
      statusBus.emitStatus(id, 'submitted', {
        chosenDex: bestQuote.dex,
        note: 'Mock transaction broadcasted',
      });

      const execution = await router.executeSwap(payload, bestQuote);
      statusBus.emitStatus(id, 'confirmed', execution);

      return execution;
    } catch (error) {
      statusBus.emitStatus(id, 'failed', {
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

