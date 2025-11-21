import { describe, it, expect } from 'vitest';
import { MockDexRouter } from '../../src/dex/mockDexRouter';
import { CreateOrderDto } from '../../src/types/order';

describe('MockDexRouter', () => {
    const router = new MockDexRouter();
    const mockOrder: CreateOrderDto = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
        wallet: 'test-wallet',
    };

    it('should return quotes from both Raydium and Meteora', async () => {
        const quotes = await router.getQuotes(mockOrder);
        expect(quotes.raydium).toBeDefined();
        expect(quotes.meteora).toBeDefined();
        expect(quotes.raydium.dex).toBe('raydium');
        expect(quotes.meteora.dex).toBe('meteora');
    });

    it('should select the best quote', async () => {
        const quotes = await router.getQuotes(mockOrder);
        const best = router.selectBestQuote(quotes);

        const maxOutput = Math.max(
            quotes.raydium.expectedOutput,
            quotes.meteora.expectedOutput
        );
        expect(best.expectedOutput).toBe(maxOutput);
    });

    it('should execute swap and return result', async () => {
        const quotes = await router.getQuotes(mockOrder);
        const best = router.selectBestQuote(quotes);
        const result = await router.executeSwap(mockOrder, best);

        expect(result.dex).toBe(best.dex);
        expect(result.txHash).toBeDefined();
        expect(result.executedPrice).toBeGreaterThan(0);
    });

    it('should handle zero amount gracefully', async () => {
        const zeroOrder: CreateOrderDto = {
            tokenIn: 'SOL',
            tokenOut: 'USDC',
            amount: 0,
        };

        const quotes = await router.getQuotes(zeroOrder);
        expect(quotes.raydium.expectedOutput).toBe(0);
        expect(quotes.meteora.expectedOutput).toBe(0);
    });

    it('should apply different fees for Raydium and Meteora', async () => {
        const quotes = await router.getQuotes(mockOrder);

        // Raydium typically has higher fees (30bps) vs Meteora (20bps)
        expect(quotes.raydium.feeBps).toBeGreaterThan(quotes.meteora.feeBps);
    });

    it('should generate unique transaction hashes', async () => {
        const quotes = await router.getQuotes(mockOrder);
        const best = router.selectBestQuote(quotes);

        const result1 = await router.executeSwap(mockOrder, best);
        const result2 = await router.executeSwap(mockOrder, best);

        expect(result1.txHash).not.toBe(result2.txHash);
    });

    it('should simulate realistic price variance between DEXs', async () => {
        const quotes = await router.getQuotes(mockOrder);

        const priceDiff = Math.abs(quotes.raydium.price - quotes.meteora.price);
        const avgPrice = (quotes.raydium.price + quotes.meteora.price) / 2;
        const variancePercent = (priceDiff / avgPrice) * 100;

        // Price variance should be within realistic bounds (0-5%)
        expect(variancePercent).toBeLessThanOrEqual(5);
        expect(variancePercent).toBeGreaterThanOrEqual(0);
    });

    it('should account for slippage in execution', async () => {
        const quotes = await router.getQuotes(mockOrder);
        const best = router.selectBestQuote(quotes);
        const result = await router.executeSwap(mockOrder, best);

        // Executed price should be close to quoted price (within ±1% slippage)
        const priceDiff = Math.abs(result.executedPrice - best.price);
        const slippagePercent = (priceDiff / best.price) * 100;

        expect(slippagePercent).toBeLessThanOrEqual(1);
    });

    it('should handle large amounts', async () => {
        const largeOrder: CreateOrderDto = {
            tokenIn: 'SOL',
            tokenOut: 'USDC',
            amount: 1000000,
        };

        const quotes = await router.getQuotes(largeOrder);
        const result = await router.executeSwap(largeOrder, quotes.raydium);

        expect(result.outputAmount).toBeGreaterThan(0);
        expect(result.txHash).toBeDefined();
    });
});
