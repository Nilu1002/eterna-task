import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { statusBus } from '../../src/events/statusBus';
import { orderStore } from '../../src/store/orderStore';

vi.mock('../../src/db/client', () => ({
    prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../src/db/client';

describe('Concurrent Operations Tests', () => {
    let prismaMock: DeepMockProxy<PrismaClient>;

    beforeEach(() => {
        prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
        vi.clearAllMocks();
    });

    it('should handle multiple concurrent status updates for same order', async () => {
        const orderId = 'concurrent-test-1';

        // Mock sequential creates
        let eventCounter = 0;
        prismaMock.orderEvent.create.mockImplementation(async (args: any) => {
            return {
                id: `event-${++eventCounter}`,
                orderId: args.data.orderId,
                status: args.data.status,
                detail: args.data.detail,
                timestamp: new Date(),
            };
        });

        // Emit multiple statuses concurrently
        const promises = [
            statusBus.emitStatus(orderId, 'pending'),
            statusBus.emitStatus(orderId, 'routing'),
            statusBus.emitStatus(orderId, 'building'),
        ];

        await Promise.all(promises);

        // All should have been persisted
        expect(prismaMock.orderEvent.create).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent saves of different orders', async () => {
        const jobs = [
            {
                id: 'order-1',
                payload: { tokenIn: 'SOL', tokenOut: 'USDC', amount: 1 },
                createdAt: new Date().toISOString(),
            },
            {
                id: 'order-2',
                payload: { tokenIn: 'SOL', tokenOut: 'USDT', amount: 2 },
                createdAt: new Date().toISOString(),
            },
            {
                id: 'order-3',
                payload: { tokenIn: 'ETH', tokenOut: 'USDC', amount: 3 },
                createdAt: new Date().toISOString(),
            },
        ];

        prismaMock.order.create.mockImplementation(async (args: any) => ({
            ...args.data,
        }));

        const promises = jobs.map((job) => orderStore.save(job as any));
        await Promise.all(promises);

        expect(prismaMock.order.create).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid status updates without data loss', async () => {
        const orderId = 'rapid-test';
        const statuses = ['pending', 'routing', 'building', 'submitted', 'confirmed'];

        let callCount = 0;
        prismaMock.orderEvent.create.mockImplementation(async (args: any) => {
            return {
                id: `event-${++callCount}`,
                orderId: args.data.orderId,
                status: args.data.status,
                detail: args.data.detail,
                timestamp: new Date(Date.now() + callCount),
            };
        });

        // Emit all statuses rapidly
        for (const status of statuses) {
            await statusBus.emitStatus(orderId, status as any);
        }

        expect(prismaMock.orderEvent.create).toHaveBeenCalledTimes(5);
    });

    it('should handle concurrent history reads', async () => {
        const orderId = 'history-read-test';
        const mockEvents = [
            {
                id: 'event-1',
                orderId,
                status: 'pending',
                detail: null,
                timestamp: new Date(),
            },
            {
                id: 'event-2',
                orderId,
                status: 'confirmed',
                detail: null,
                timestamp: new Date(),
            },
        ];

        prismaMock.orderEvent.findMany.mockResolvedValue(mockEvents as any);

        // Read history concurrently from multiple sources
        const promises = [
            orderStore.getHistory(orderId),
            orderStore.getHistory(orderId),
            orderStore.getHistory(orderId),
        ];

        const results = await Promise.all(promises);

        // All should return same data
        expect(results).toHaveLength(3);
        results.forEach((result) => {
            expect(result).toHaveLength(2);
            expect(result[0].status).toBe('pending');
        });

        // Database should be queried for each request
        expect(prismaMock.orderEvent.findMany).toHaveBeenCalledTimes(3);
    });

    it('should handle subscriber race condition', async () => {
        const orderId = 'subscriber-race';

        prismaMock.orderEvent.create.mockResolvedValue({
            id: 'event-1',
            orderId,
            status: 'pending',
            detail: null,
            timestamp: new Date(),
        });

        const listener1 = vi.fn();
        const listener2 = vi.fn();
        const listener3 = vi.fn();

        // Subscribe all at once
        statusBus.subscribe(orderId, listener1);
        statusBus.subscribe(orderId, listener2);
        statusBus.subscribe(orderId, listener3);

        await statusBus.emitStatus(orderId, 'pending');

        // All listeners should receive the event
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(1);
        expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should handle partial database failures in concurrent operations', async () => {
        const orderIds = ['order-1', 'order-2', 'order-3'];

        // Make middle one fail
        prismaMock.orderEvent.create.mockImplementation(async (args: any) => {
            if (args.data.orderId === 'order-2') {
                throw new Error('DB Error for order-2');
            }
            return {
                id: `event-${args.data.orderId}`,
                orderId: args.data.orderId,
                status: args.data.status,
                detail: args.data.detail,
                timestamp: new Date(),
            };
        });

        const results = await Promise.allSettled(
            orderIds.map((id) => statusBus.emitStatus(id, 'pending'))
        );

        // Two should succeed, one should fail
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
        expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });

    it('should handle burst of concurrent order submissions', async () => {
        const orderCount = 10;
        const orders = Array.from({ length: orderCount }, (_, i) => ({
            id: `burst-order-${i}`,
            payload: {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: i + 1,
            },
            createdAt: new Date().toISOString(),
        }));

        prismaMock.order.create.mockImplementation(async (args: any) => ({
            ...args.data,
        }));

        const startTime = Date.now();
        await Promise.all(orders.map((order) => orderStore.save(order as any)));
        const duration = Date.now() - startTime;

        expect(prismaMock.order.create).toHaveBeenCalledTimes(orderCount);
        // Should complete reasonably fast (under 1 second for mocked calls)
        expect(duration).toBeLessThan(1000);
    });
});
