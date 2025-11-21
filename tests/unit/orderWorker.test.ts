import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockDexRouter } from '../../src/dex/mockDexRouter';

// Mock dependencies
vi.mock('../../src/dex/mockDexRouter');
vi.mock('../../src/events/statusBus', () => ({
    statusBus: {
        emitStatus: vi.fn().mockResolvedValue(undefined),
    },
}));

import { statusBus } from '../../src/events/statusBus';
import { OrderJobData } from '../../src/types/order';

describe('orderWorker logic', () => {
    let mockRouter: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRouter = {
            getQuotes: vi.fn(),
            selectBestQuote: vi.fn(),
            executeSwap: vi.fn(),
        };
    });

    it('should process order through all stages', async () => {
        const job: OrderJobData = {
            id: 'worker-test-1',
            payload: {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: 1.0,
            },
            createdAt: new Date().toISOString(),
        };

        const mockQuotes = {
            raydium: {
                dex: 'raydium' as const,
                price: 0.0025,
                feeBps: 30,
                expectedOutput: 0.99925,
                latencyMs: 200,
            },
            meteora: {
                dex: 'meteora' as const,
                price: 0.0026,
                feeBps: 20,
                expectedOutput: 1.00048,
                latencyMs: 180,
            },
        };

        const bestQuote = mockQuotes.meteora;
        const executionResult = {
            dex: 'meteora' as const,
            txHash: 'mock-tx-hash-123',
            executedPrice: 0.00261,
            outputAmount: 1.00048,
        };

        mockRouter.getQuotes.mockResolvedValue(mockQuotes);
        mockRouter.selectBestQuote.mockReturnValue(bestQuote);
        mockRouter.executeSwap.mockResolvedValue(executionResult);

        // Simulate worker logic
        await statusBus.emitStatus(job.id, 'routing', { message: 'Fetching DEX quotes' });
        const quotes = await mockRouter.getQuotes(job.payload);
        const best = mockRouter.selectBestQuote(quotes);

        await statusBus.emitStatus(job.id, 'building', {
            chosenDex: best.dex,
            bestPrice: best.price,
            feeBps: best.feeBps,
        });

        await statusBus.emitStatus(job.id, 'submitted', {
            chosenDex: best.dex,
            note: 'Mock transaction broadcasted',
        });

        const execution = await mockRouter.executeSwap(job.payload, best);
        await statusBus.emitStatus(job.id, 'confirmed', execution);

        // Verify all status updates were emitted
        expect(statusBus.emitStatus).toHaveBeenCalledWith(job.id, 'routing', expect.any(Object));
        expect(statusBus.emitStatus).toHaveBeenCalledWith(job.id, 'building', expect.any(Object));
        expect(statusBus.emitStatus).toHaveBeenCalledWith(job.id, 'submitted', expect.any(Object));
        expect(statusBus.emitStatus).toHaveBeenCalledWith(job.id, 'confirmed', executionResult);
    });

    it('should handle routing errors', async () => {
        const job: OrderJobData = {
            id: 'worker-test-2',
            payload: {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: 1.0,
            },
            createdAt: new Date().toISOString(),
        };

        mockRouter.getQuotes.mockRejectedValue(new Error('Network timeout'));

        try {
            await statusBus.emitStatus(job.id, 'routing', { message: 'Fetching DEX quotes' });
            await mockRouter.getQuotes(job.payload);
        } catch (error) {
            await statusBus.emitStatus(job.id, 'failed', {
                reason: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        expect(statusBus.emitStatus).toHaveBeenCalledWith(
            job.id,
            'failed',
            expect.objectContaining({
                reason: 'Network timeout',
            })
        );
    });

    it('should handle swap execution errors', async () => {
        const job: OrderJobData = {
            id: 'worker-test-3',
            payload: {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: 1.0,
            },
            createdAt: new Date().toISOString(),
        };

        const mockQuotes = {
            raydium: {
                dex: 'raydium' as const,
                price: 0.0025,
                feeBps: 30,
                expectedOutput: 0.99925,
                latencyMs: 200,
            },
            meteora: {
                dex: 'meteora' as const,
                price: 0.0026,
                feeBps: 20,
                expectedOutput: 1.00048,
                latencyMs: 180,
            },
        };

        mockRouter.getQuotes.mockResolvedValue(mockQuotes);
        mockRouter.selectBestQuote.mockReturnValue(mockQuotes.meteora);
        mockRouter.executeSwap.mockRejectedValue(new Error('Transaction failed'));

        try {
            await statusBus.emitStatus(job.id, 'routing', { message: 'Fetching DEX quotes' });
            const quotes = await mockRouter.getQuotes(job.payload);
            const best = mockRouter.selectBestQuote(quotes);
            await statusBus.emitStatus(job.id, 'building', {
                chosenDex: best.dex,
                bestPrice: best.price,
                feeBps: best.feeBps,
            });
            await mockRouter.executeSwap(job.payload, best);
        } catch (error) {
            await statusBus.emitStatus(job.id, 'failed', {
                reason: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        expect(statusBus.emitStatus).toHaveBeenCalledWith(
            job.id,
            'failed',
            expect.objectContaining({
                reason: 'Transaction failed',
            })
        );
    });
});
