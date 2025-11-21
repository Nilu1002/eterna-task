import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { config } from './config/env';
import { orderRoutes } from './routes/orderRoutes';

export const buildServer = async () => {
  const app = Fastify({
    logger: true,
  });

  await app.register(websocket);
  await app.register(orderRoutes);

  // Serve static files from client/dist in production
  const clientDistPath = path.join(process.cwd(), 'client/dist');
  try {
    await app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/', // optional: default '/'
    });

    // SPA fallback: serve index.html for all non-API routes
    app.setNotFoundHandler(async (request: any, reply: any) => {
      // Don't interfere with API routes
      if (request.url.startsWith('/api')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      // Serve index.html for client routes
      return reply.sendFile('index.html');
    });
  } catch (error) {
    // Client dist might not exist in development, that's okay
    app.log.warn('Client dist directory not found, skipping static file serving');
  }

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