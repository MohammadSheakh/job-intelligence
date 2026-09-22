import { Global, Module } from '@nestjs/common';
import { RedisProvider } from './redis.provider.js';
import { RedisClientsLifecycle } from './redis.lifecycle.js';

@Global()
@Module({
  providers: [RedisProvider, RedisClientsLifecycle],
  exports: [RedisProvider],
})
export class RedisModule {}
