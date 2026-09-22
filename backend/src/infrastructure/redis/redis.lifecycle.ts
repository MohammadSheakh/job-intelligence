import { Inject, Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@app/common';

/**
 * Owns the raw ioredis client lifecycle so Nest application shutdown
 * cleanly disconnects open Redis sockets.
 */
@Injectable()
export class RedisClientsLifecycle implements OnModuleDestroy {
  private readonly logger = new Logger(RedisClientsLifecycle.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
  ) {}

  onModuleDestroy(): void {
    if (this.redisClient) {
      this.logger.log('Disconnecting Redis client on application teardown.');
      try {
        this.redisClient.disconnect();
      } catch (err) {
        this.logger.warn(`Error disconnecting Redis client: ${(err as Error).message}`);
      }
    }
  }
}
