import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { statusBus } from '../../src/events/statusBus';
import { OrderStatus } from '../../src/types/order';

vi.mock('../../src/db/client', () => ({
    prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../src/db/client';

describe('statusBus', () => {
    let prismaMock: DeepMockProxy<PrismaClient>;

    beforeEach(() => {
        prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
        vi.clearAllMocks();
    });

    it('should emit status and persist to database', async () => {
        const orderId = 'test-order';
        const status: OrderStatus = 'routing';
        const detail = { message: 'Fetching quotes' };

        prismaMock.orderEvent.create.mockResolvedValue({
            id: 'event-1',
            orderId,
            status,
            detail: detail as any,
            timestamp: new Date(),
        });

        const listener = vi.fn();
        statusBus.subscribe(orderId, listener);

        await statusBus.emitStatus(orderId, status, detail);

        expect(prismaMock.orderEvent.create).toHaveBeenCalledWith({
            data: {
                orderId,
                status,
                detail,
            },
        });

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId,
                status,
                detail,
            })
        );
    });

    it('should support multiple subscribers', async () => {
        const orderId = 'multi-test';

        prismaMock.orderEvent.create.mockResolvedValue({
            id: 'event-2',
            orderId,
            status: 'confirmed',
            detail: null,
            timestamp: new Date(),
        });

        const listener1 = vi.fn();
        const listener2 = vi.fn();
        const listener3 = vi.fn();

        statusBus.subscribe(orderId, listener1);
        statusBus.subscribe(orderId, listener2);
        statusBus.subscribe(orderId, listener3);

        await statusBus.emitStatus(orderId, 'confirmed');

        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
        expect(listener3).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', async () => {
        const orderId = 'unsub-test';

        prismaMock.orderEvent.create.mockResolvedValue({
            id: 'event-3',
            orderId,
            status: 'pending',
            detail: null,
            timestamp: new Date(),
        });

        const listener = vi.fn();
        const unsubscribe = statusBus.subscribe(orderId, listener);

        await statusBus.emitStatus(orderId, 'pending');
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();

        await statusBus.emitStatus(orderId, 'routing');
        expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle database failure gracefully', async () => {
        const orderId = 'fail-test';

        prismaMock.orderEvent.create.mockRejectedValue(new Error('DB Error'));

        const listener = vi.fn();
        statusBus.subscribe(orderId, listener);

        await expect(statusBus.emitStatus(orderId, 'pending')).rejects.toThrow(
            'DB Error'
        );

        // Listener should not be called if persistence fails
        expect(listener).not.toHaveBeenCalled();
    });

    it('should handle all status transitions', async () => {
        const orderId = 'status-test';
        const statuses: OrderStatus[] = [
            'pending',
            'routing',
            'building',
            'submitted',
            'confirmed',
        ];

        for (const status of statuses) {
            prismaMock.orderEvent.create.mockResolvedValue({
                id: `event-${status}`,
                orderId,
                status,
                detail: null,
                timestamp: new Date(),
            });

            await statusBus.emitStatus(orderId, status);

            expect(prismaMock.orderEvent.create).toHaveBeenCalledWith({
                data: {
                    orderId,
                    status,
                    detail: undefined,
                },
            });
        }
    });

    it('should handle failed status with error details', async () => {
        const orderId = 'error-test';
        const errorDetail = {
            reason: 'Network timeout',
            code: 'TIMEOUT',
        };

        prismaMock.orderEvent.create.mockResolvedValue({
            id: 'event-fail',
            orderId,
            status: 'failed',
            detail: errorDetail as any,
            timestamp: new Date(),
        });

        const listener = vi.fn();
        statusBus.subscribe(orderId, listener);

        await statusBus.emitStatus(orderId, 'failed', errorDetail);

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'failed',
                detail: errorDetail,
            })
        );
    });
});
