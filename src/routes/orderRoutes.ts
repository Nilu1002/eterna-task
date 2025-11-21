import { FastifyInstance, FastifyRequest } from 'fastify';
import WebSocket from 'ws';
import { z } from 'zod';
import { getOrderHistory, submitOrder } from '../services/orderService';
import { statusBus } from '../events/statusBus';

const createOrderSchema = z.object({
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amount: z.coerce.number().positive(),
  wallet: z.string().optional(),
});

export async function orderRoutes(app: FastifyInstance) {
  app.post('/api/orders/execute', async (request, reply) => {
    const body = createOrderSchema.parse(request.body);
    const job = await submitOrder(body);
    reply.code(202).send({
      orderId: job.id,
      statusEndpoint: `/api/orders/${job.id}/status`,
      createdAt: job.createdAt,
    });
  });

  app.get<{ Params: { orderId: string } }>(
    '/api/orders/:orderId/status',
    { websocket: true },
    (socket: WebSocket, request: FastifyRequest<{ Params: { orderId: string } }>) => {
      const { orderId } = request.params;
      const previous = getOrderHistory(orderId);
      socket.send(
        JSON.stringify({
          type: 'history',
          data: previous,
        })
      );

      const unsubscribe = statusBus.subscribe(orderId, (update) => {
        socket.send(
          JSON.stringify({
            type: 'update',
            data: update,
          })
        );
      });

      socket.on('close', () => unsubscribe());
    }
  );

  app.get<{ Params: { orderId: string } }>(
    '/api/orders/:orderId/history',
    async (request, reply) => {
      const { orderId } = request.params;
    const history = getOrderHistory(orderId);
    reply.send({
      orderId,
      history,
    });
    }
  );
}

