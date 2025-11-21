import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { submitOrder, getOrderHistory } from '../../src/services/orderService';

// Mock dependencies
vi.mock('../../src/db/client', () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock('../../src/queue/orderQueue', () => ({
    enqueueOrder: vi.fn().mockResolvedValue({ id: 'job-id' }),
}));

vi.mock('../../src/events/statusBus', () => ({
    statusBus: {
        emitStatus: vi.fn().mockResolvedValue(undefined),
    },
}));

import { prisma } from '../../src/db/client';
import { enqueueOrder } from '../../src/queue/orderQueue';
import { statusBus } from '../../src/events/statusBus';

describe('orderService', () => {
    let prismaMock: DeepMockProxy<PrismaClient>;

    beforeEach(() => {
        prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
        vi.clearAllMocks();
    });

    describe('submitOrder', () => {
        it('should create order and enqueue it', async () => {
            const payload = {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: 1.5,
            };

            prismaMock.order.create.mockResolvedValue({
                id: 'order-123',
                ...payload,
                wallet: null,
                orderType: 'market',
                createdAt: new Date(),
            } as any);

            const job = await submitOrder(payload);

            expect(job.id).toBeDefined();
            expect(job.payload.tokenIn).toBe(payload.tokenIn);
            expect(job.payload.orderType).toBe('market');
            expect(prismaMock.order.create).toHaveBeenCalled();
            expect(enqueueOrder).toHaveBeenCalled();
            expect(statusBus.emitStatus).toHaveBeenCalledWith(
                job.id,
                'pending',
                expect.any(Object)
            );
        });

        it('should handle wallet address', async () => {
            const payload = {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: 1.0,
                wallet: '0x1234567890abcdef',
            };

            prismaMock.order.create.mockResolvedValue({
                id: 'order-456',
                ...payload,
                orderType: 'market',
                createdAt: new Date(),
            } as any);

            const job = await submitOrder(payload);

            expect(job.payload.wallet).toBe(payload.wallet);
        });

        it('should propagate database errors', async () => {
            prismaMock.order.create.mockRejectedValue(new Error('DB Error'));

            await expect(
                submitOrder({
                    tokenIn: 'SOL',
                    tokenOut: 'USDC',
                    amount: 1,
                })
            ).rejects.toThrow('DB Error');
        });
    });

    describe('getOrderHistory', () => {
        it('should retrieve order history', async () => {
            const orderId = 'test-order-id';
            const mockEvents = [
                {
                    id: 'event-1',
                    orderId,
                    status: 'pending',
                    detail: {},
                    timestamp: new Date(),
                },
                {
                    id: 'event-2',
                    orderId,
                    status: 'routing',
                    detail: {},
                    timestamp: new Date(),
                },
            ];

            prismaMock.orderEvent.findMany.mockResolvedValue(mockEvents as any);

            const history = await getOrderHistory(orderId);

            expect(history).toHaveLength(2);
            expect(history[0].status).toBe('pending');
            expect(history[1].status).toBe('routing');
            expect(prismaMock.orderEvent.findMany).toHaveBeenCalledWith({
                where: { orderId },
                orderBy: { timestamp: 'asc' },
            });
        });

        it('should return empty array for non-existent order', async () => {
            prismaMock.orderEvent.findMany.mockResolvedValue([]);

            const history = await getOrderHistory('non-existent');

            expect(history).toEqual([]);
        });

        it('should handle database errors', async () => {
            prismaMock.orderEvent.findMany.mockRejectedValue(new Error('DB Error'));

            await expect(getOrderHistory('test-id')).rejects.toThrow('DB Error');
        });
    });
});
