import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import supertest from 'supertest';
import WebSocket from 'ws';
import { buildServer } from '../../src/server';

// Mock dependencies
vi.mock('../../src/db/client', () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock('../../src/queue/orderQueue', () => ({
    enqueueOrder: vi.fn().mockResolvedValue({ id: 'job-id' }),
    orderQueue: {
        add: vi.fn(),
    },
}));

import { prisma } from '../../src/db/client';

describe('WebSocket and API Tests', () => {
    let app: any;
    let prismaMock: DeepMockProxy<PrismaClient>;

    beforeEach(async () => {
        prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
        vi.clearAllMocks();
        app = await buildServer();
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    describe('Health Endpoint', () => {
        it('should return health status', async () => {
            const response = await supertest(app.server)
                .get('/health')
                .expect(200);

            expect(response.body.status).toBe('ok');
            expect(response.body.redis).toBeDefined();
        });
    });

    describe('Order History Endpoint', () => {
        it('should return order history', async () => {
            const orderId = 'test-order-123';
            const mockHistory = [
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
                    status: 'confirmed',
                    detail: { txHash: 'mock-tx' },
                    timestamp: new Date(),
                },
            ];

            prismaMock.orderEvent.findMany.mockResolvedValue(mockHistory as any);

            const response = await supertest(app.server)
                .get(`/api/orders/${orderId}/history`)
                .expect(200);

            expect(response.body.orderId).toBe(orderId);
            expect(response.body.history).toHaveLength(2);
            expect(response.body.history[0].status).toBe('pending');
        });

        it('should handle non-existent order', async () => {
            prismaMock.orderEvent.findMany.mockResolvedValue([]);

            const response = await supertest(app.server)
                .get('/api/orders/non-existent/history')
                .expect(200);

            expect(response.body.history).toEqual([]);
        });
    });

    describe('Order Submission Edge Cases', () => {
        it('should reject order with negative amount', async () => {
            const payload = {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: -1.5,
            };

            await supertest(app.server)
                .post('/api/orders/execute')
                .send(payload)
                .expect(400);

            expect(prismaMock.order.create).not.toHaveBeenCalled();
        });

        it('should reject order with empty tokenIn', async () => {
            const payload = {
                tokenIn: '',
                tokenOut: 'USDC',
                amount: 1.5,
            };

            await supertest(app.server)
                .post('/api/orders/execute')
                .send(payload)
                .expect(400);
        });

        it('should reject order with missing fields', async () => {
            const payload = {
                tokenIn: 'SOL',
                // Missing tokenOut and amount
            };

            await supertest(app.server)
                .post('/api/orders/execute')
                .send(payload)
                .expect(400);
        });

        it('should accept order with optional wallet field', async () => {
            const payload = {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: 1.5,
                wallet: '0xABCDEF123456',
            };

            prismaMock.order.create.mockResolvedValue({
                id: 'order-with-wallet',
                ...payload,
                orderType: 'market',
                createdAt: new Date(),
            } as any);

            prismaMock.orderEvent.create.mockResolvedValue({
                id: 'event-id',
                orderId: 'order-with-wallet',
                status: 'pending',
                detail: {},
                timestamp: new Date(),
            } as any);

            const response = await supertest(app.server)
                .post('/api/orders/execute')
                .send(payload)
                .expect(202);

            expect(response.body.orderId).toBeDefined();
            expect(prismaMock.order.create).toHaveBeenCalled();
        });

        it('should handle very large amounts', async () => {
            const payload = {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: 1000000000,
            };

            prismaMock.order.create.mockResolvedValue({
                id: 'large-order',
                ...payload,
                wallet: null,
                orderType: 'market',
                createdAt: new Date(),
            } as any);

            prismaMock.orderEvent.create.mockResolvedValue({
                id: 'event-id',
                orderId: 'large-order',
                status: 'pending',
                detail: {},
                timestamp: new Date(),
            } as any);

            await supertest(app.server)
                .post('/api/orders/execute')
                .send(payload)
                .expect(202);
        });

        it('should handle very small amounts', async () => {
            const payload = {
                tokenIn: 'SOL',
                tokenOut: 'USDC',
                amount: 0.000001,
            };

            prismaMock.order.create.mockResolvedValue({
                id: 'small-order',
                ...payload,
                wallet: null,
                orderType: 'market',
                createdAt: new Date(),
            } as any);

            prismaMock.orderEvent.create.mockResolvedValue({
                id: 'event-id',
                orderId: 'small-order',
                status: 'pending',
                detail: {},
                timestamp: new Date(),
            } as any);

            await supertest(app.server)
                .post('/api/orders/execute')
                .send(payload)
                .expect(202);
        });
    });
});
