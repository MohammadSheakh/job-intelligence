import { Provider, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@app/common';

/**
 * Creates an ioredis client if Redis host or URL is configured;
 * otherwise gracefully returns null to support zero-config environments.
 */
export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis | null => {
    const logger = new Logger('RedisProvider');
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;

    if (!redisUrl && !redisHost) {
      logger.log(
        'Redis configuration not found; running with in-memory / fail-open rate limiting.',
      );
      return null;
    }

    try {
      const client = redisUrl
        ? new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
              if (times > 5) {
                logger.warn('Max Redis connection retry attempts reached; failing open.');
                return null;
              }
              return Math.min(times * 200, 2000);
            },
          })
        : new Redis({
            host: redisHost,
            port: Number(process.env.REDIS_PORT ?? 6379),
            password: process.env.REDIS_PASSWORD || undefined,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
              if (times > 5) {
                logger.warn('Max Redis connection retry attempts reached; failing open.');
                return null;
              }
              return Math.min(times * 200, 2000);
            },
          });

      client.on('error', (err) => {
        logger.error('Redis connection error:', err.message);
      });

      client.on('connect', () => {
        logger.log('Connected to Redis server for sliding window rate limiting.');
      });

      return client;
    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
      return null;
    }
  },
};
