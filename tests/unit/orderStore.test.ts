import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { orderStore } from '../../src/store/orderStore';
import { OrderJobData } from '../../src/types/order';

// Mock the prisma client module
vi.mock('../../src/db/client', () => ({
    prisma: mockDeep<PrismaClient>(),
}));

// Import the mocked prisma instance (it will be the mock due to vi.mock)
import { prisma } from '../../src/db/client';

describe('orderStore', () => {
    let prismaMock: DeepMockProxy<PrismaClient>;

    beforeEach(() => {
        prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
        vi.clearAllMocks();
    });

    it('should save an order', async () => {
        const job: OrderJobData = {
            id: 'test-id',
            payload: {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: 1,
                orderType: 'market',
            },
            createdAt: new Date().toISOString(),
        };

        await orderStore.save(job);

        expect(prismaMock.order.create).toHaveBeenCalledWith({
            data: {
                id: job.id,
                tokenIn: job.payload.tokenIn,
                tokenOut: job.payload.tokenOut,
                amount: job.payload.amount,
                wallet: undefined,
                orderType: 'market',
                createdAt: new Date(job.createdAt),
            },
        });
    });

    it('should append status', async () => {
        const orderId = 'test-id';
        const status = 'pending';
        const detail = { note: 'test' };

        // Mock the return value
        prismaMock.orderEvent.create.mockResolvedValue({
            id: 'event-id',
            orderId,
            status,
            detail: detail as any,
            timestamp: new Date(),
        });

        const result = await orderStore.appendStatus(orderId, status, detail);

        expect(prismaMock.orderEvent.create).toHaveBeenCalledWith({
            data: {
                orderId,
                status,
                detail,
            },
        });
        expect(result).toBeDefined();
        expect(result?.status).toBe(status);
    });
});
