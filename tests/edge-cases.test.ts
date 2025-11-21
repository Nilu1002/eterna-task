import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { orderStore } from '../src/store/orderStore';

vi.mock('../src/db/client', () => ({
    prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../src/db/client';

describe('Edge Cases', () => {
    let prismaMock: DeepMockProxy<PrismaClient>;

    beforeEach(() => {
        prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
        vi.clearAllMocks();
    });

    it('should handle database connection failure gracefully on save', async () => {
        const job = {
            id: 'fail-id',
            payload: { tokenIn: 'A', tokenOut: 'B', amount: 1 },
            createdAt: new Date().toISOString(),
        };

        prismaMock.order.create.mockRejectedValue(new Error('DB Connection Failed'));

        await expect(orderStore.save(job as any)).rejects.toThrow('DB Connection Failed');
    });

    it('should handle database failure on status update', async () => {
        prismaMock.orderEvent.create.mockRejectedValue(new Error('DB Error'));

        await expect(orderStore.appendStatus('id', 'pending')).rejects.toThrow('DB Error');
    });

    it('should handle database connection timeout', async () => {
        prismaMock.order.create.mockImplementation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            throw new Error('Connection timeout');
        });

        await expect(
            orderStore.save({
                id: 'timeout-test',
                payload: { tokenIn: 'A', tokenOut: 'B', amount: 1 },
                createdAt: new Date().toISOString(),
            } as any)
        ).rejects.toThrow('Connection timeout');
    });

    it('should handle malformed data from database', async () => {
        // Database returns invalid data
        prismaMock.orderEvent.findMany.mockResolvedValue([
            {
                id: 'bad-event',
                orderId: 'test',
                status: null as any, // Invalid status
                detail: null,
                timestamp: new Date(),
            },
        ] as any);

        const history = await orderStore.getHistory('test');

        // Should still return the data, even if malformed
        expect(history).toHaveLength(1);
        expect(history[0].status).toBeNull();
    });

    it('should handle very long order IDs', async () => {
        const longId = 'x'.repeat(1000);

        prismaMock.orderEvent.create.mockResolvedValue({
            id: 'event-1',
            orderId: longId,
            status: 'pending',
            detail: null,
            timestamp: new Date(),
        } as any);

        const result = await orderStore.appendStatus(longId, 'pending');
        expect(result?.orderId).toBe(longId);
    });

    it('should handle special characters in order details', async () => {
        const specialDetail = {
            message: "It's a test with 'quotes' and \"double quotes\"",
            symbols: '<>&%$#@!',
            unicode: '🚀💰📈',
        };

        prismaMock.orderEvent.create.mockResolvedValue({
            id: 'event-special',
            orderId: 'test',
            status: 'pending',
            detail: specialDetail as any,
            timestamp: new Date(),
        });

        const result = await orderStore.appendStatus('test', 'pending', specialDetail);
        expect(result?.detail).toEqual(specialDetail);
    });

    it('should handle missing database connection', async () => {
        // Simulate database completely unavailable
        prismaMock.order.create.mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(
            orderStore.save({
                id: 'no-db',
                payload: { tokenIn: 'A', tokenOut: 'B', amount: 1 },
                createdAt: new Date().toISOString(),
            } as any)
        ).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle database deadlock', async () => {
        prismaMock.orderEvent.create.mockRejectedValue(
            new Error('deadlock detected')
        );

        await expect(
            orderStore.appendStatus('deadlock-test', 'pending')
        ).rejects.toThrow('deadlock detected');
    });
});
