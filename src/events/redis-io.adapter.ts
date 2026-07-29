import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

// Backend runs multiple replicas (see k8s/deployment.yaml) behind an ALB
// that round-robins each request independently, so a visitor's socket and
// the pod that later calls server.to(room).emit(...) (e.g. an agent
// replying via REST, handled in widget/ticket/bot/report services) can
// easily land on different pods. Without this adapter, that emit only
// reaches sockets connected to the SAME process — on another pod it's
// silently dropped. This is the suspected root cause of the "agent closed
// chat but no feedback panel appeared" issue flagged in
// chatbu-frontend's ChatFormPublic.tsx chat_ended handler.
// Reuses the existing shared `redis-service:6379` in the chatbu namespace
// (already deployed for other services) — no dedicated Redis needed.
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(redisUrl: string): Promise<void> {
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => this.logger.error(`Redis pub client error: ${err.message}`));
    subClient.on('error', (err) => this.logger.error(`Redis sub client error: ${err.message}`));

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        pubClient.once('ready', resolve);
        pubClient.once('error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        subClient.once('ready', resolve);
        subClient.once('error', reject);
      }),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Connected to Redis for socket.io cross-pod adapter');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    } else {
      this.logger.warn('Redis adapter not connected — socket.io running without cross-pod broadcast');
    }
    return server;
  }
}
