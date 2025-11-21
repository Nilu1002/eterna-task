import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { config } from './config/env';
import { orderRoutes } from './routes/orderRoutes';

export const buildServer = async () => {
  const app = Fastify({
    logger: true,
  });

  await app.register(websocket);
  await app.register(orderRoutes);

  app.get('/health', async () => ({
    status: 'ok',
    redis: config.redis.url,
  }));

  return app;
};

const start = async () => {
  const server = await buildServer();
  try {
    await server.listen({ port: config.port, host: '0.0.0.0' });
    server.log.info(`Server listening on port ${config.port}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

