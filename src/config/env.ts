import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: numberFromEnv(process.env.PORT, 4000),
  redis: {
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  },
  queue: {
    name: process.env.ORDER_QUEUE_NAME ?? 'order-execution',
    maxAttempts: numberFromEnv(process.env.ORDER_MAX_ATTEMPTS, 3),
    backoffMs: numberFromEnv(process.env.ORDER_BACKOFF_MS, 1500),
    concurrency: numberFromEnv(process.env.ORDER_CONCURRENCY, 5),
  },
  mockDex: {
    basePrice: numberFromEnv(process.env.MOCK_BASE_PRICE, 0.0025), // 0.0025 SOL per token
    raydiumFeeBps: numberFromEnv(process.env.RAYDIUM_FEE_BPS, 30),
    meteoraFeeBps: numberFromEnv(process.env.METEORA_FEE_BPS, 20),
  },
};

