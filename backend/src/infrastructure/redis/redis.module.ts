import { Global, Module } from '@nestjs/common';
import { RedisProvider } from './redis.provider.js';

@Global()
@Module({
  providers: [RedisProvider],
  exports: [RedisProvider],
})
export class RedisModule {}
