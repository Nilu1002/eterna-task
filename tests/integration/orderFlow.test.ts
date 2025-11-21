import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import supertest from 'supertest';
import { buildServer } from '../../src/server';

// Mock dependencies
vi.mock('../../src/db/client', () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock('../../src/queue/orderQueue', () => ({
    enqueueOrder: vi.fn(),
    orderQueue: {
        add: vi.fn(),
    },
}));

import { prisma } from '../../src/db/client';
import { enqueueOrder } from '../../src/queue/orderQueue';

describe('Order Integration Flow', () => {
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

    it('should accept a valid order', async () => {
        const payload = {
            tokenIn: 'SOL',
            tokenOut: 'USDC',
            amount: 1.5,
            wallet: 'test-wallet',
        };

        // Mock Prisma create
        prismaMock.order.create.mockResolvedValue({
            id: 'test-order-id',
            ...payload,
            orderType: 'market',
            createdAt: new Date(),
        } as any);

        // Mock Prisma orderEvent create
        prismaMock.orderEvent.create.mockResolvedValue({
            id: 'event-id',
            orderId: 'test-order-id',
            status: 'pending',
            detail: {},
            timestamp: new Date(),
        } as any);

        const response = await supertest(app.server)
            .post('/api/orders/execute')
            .send(payload)
            .expect(202);

        expect(response.body.orderId).toBeDefined();
        expect(response.body.statusEndpoint).toContain('/api/orders/');

        // Verify persistence called
        expect(prismaMock.order.create).toHaveBeenCalled();
        // Verify queue called
        expect(enqueueOrder).toHaveBeenCalled();
    });

    it('should reject invalid order', async () => {
        const payload = {
            tokenIn: '', // Invalid
            tokenOut: 'USDC',
            amount: -1, // Invalid
        };

        await supertest(app.server)
            .post('/api/orders/execute')
            .send(payload)
            .expect(400);

        expect(prismaMock.order.create).not.toHaveBeenCalled();
    });
});
