import { FastifyInstance, FastifyRequest } from 'fastify';
import WebSocket from 'ws';
import { z } from 'zod';
import { getOrderHistory, submitOrder, getAllOrders } from '../services/orderService';
import { statusBus } from '../events/statusBus';

const createOrderSchema = z.object({
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amount: z.coerce.number().positive(),
  wallet: z.string().optional(),
});

export async function orderRoutes(app: FastifyInstance) {
  app.post('/api/orders/execute', async (request, reply) => {
    const result = createOrderSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Validation Error',
        details: result.error.format(),
      });
    }
    const body = result.data;
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
    async (socket: WebSocket, request: FastifyRequest<{ Params: { orderId: string } }>) => {
      const { orderId } = request.params;
      const previous = await getOrderHistory(orderId);
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

  app.get('/api/orders', async (request, reply) => {
    const orders = await getAllOrders();
    reply.send(orders);
  });
}
