import { randomBytes } from 'node:crypto';
import { config } from '../config/env';
import { CreateOrderDto, DexQuote, ExecutionResult } from '../types/order';
import { delay, randomInRange } from '../utils/timing';

export class MockDexRouter {
  private basePrice: number;

  constructor(basePrice = config.mockDex.basePrice) {
    this.basePrice = basePrice;
  }

  async getQuotes(order: CreateOrderDto): Promise<{
    raydium: DexQuote;
    meteora: DexQuote;
  }> {
    const [raydium, meteora] = await Promise.all([
      this.buildQuote('raydium', order),
      this.buildQuote('meteora', order),
    ]);

    return { raydium, meteora };
  }

  selectBestQuote(quotes: { raydium: DexQuote; meteora: DexQuote }) {
    return quotes.raydium.expectedOutput >= quotes.meteora.expectedOutput
      ? quotes.raydium
      : quotes.meteora;
  }

  async executeSwap(order: CreateOrderDto, quote: DexQuote): Promise<ExecutionResult> {
    await delay(randomInRange(1800, 2600));
    const slip = randomInRange(-0.01, 0.01); // ±1% slippage
    const executedPrice = quote.price * (1 + slip);
    const outputAmount = order.amount * executedPrice * (1 - quote.feeBps / 10_000);

    return {
      dex: quote.dex,
      txHash: this.generateMockTxHash(),
      executedPrice,
      outputAmount,
    };
  }

  private async buildQuote(dex: DexQuote['dex'], order: CreateOrderDto): Promise<DexQuote> {
    const variance =
      dex === 'raydium' ? randomInRange(0.98, 1.02) : randomInRange(0.97, 1.03);
    const price = this.basePrice * variance;
    const feeBps = dex === 'raydium' ? config.mockDex.raydiumFeeBps : config.mockDex.meteoraFeeBps;
    const expectedOutput = order.amount * price * (1 - feeBps / 10_000);
    const latencyMs = randomInRange(180, 360);
    await delay(latencyMs);

    return {
      dex,
      price,
      feeBps,
      expectedOutput,
      latencyMs,
    };
  }

  private generateMockTxHash() {
    return randomBytes(32).toString('hex');
  }
}

