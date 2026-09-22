import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SlidingWindowRateLimitGuard } from '@app/common';
import type { Redis } from 'ioredis';

describe('SlidingWindowRateLimitGuard', () => {
  let guard: SlidingWindowRateLimitGuard;
  let reflector: Reflector;
  let mockRedis: unknown;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('bypasses when no @RateLimit option is configured on route', async () => {
    guard = new SlidingWindowRateLimitGuard(reflector, null);
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const context = {
      getHandler: () => {},
    } as unknown as ExecutionContext;

    expect(await guard.canActivate(context)).toBe(true);
  });

  it('fails open when redis client is not provided in test environment', async () => {
    guard = new SlidingWindowRateLimitGuard(reflector, null);
    jest.spyOn(reflector, 'get').mockReturnValue({ windowMs: 60000, max: 10, keyPrefix: 'test' });

    const context = {
      getHandler: () => {},
    } as unknown as ExecutionContext;

    expect(await guard.canActivate(context)).toBe(true);
  });

  it('enforces limit and sets rate limit headers when Redis is available', async () => {
    const pipelineMock = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zrange: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0], // zremrangebyscore
        [null, 1], // zadd
        [null, 1], // expire
        [null, 5], // zcard (count = 5)
        [null, ['1600000000', '1600000000']], // zrange
      ]),
    };

    mockRedis = {
      multi: jest.fn().mockReturnValue(pipelineMock),
    };

    guard = new SlidingWindowRateLimitGuard(reflector, mockRedis as Redis);
    jest.spyOn(reflector, 'get').mockReturnValue({ windowMs: 60000, max: 10, keyPrefix: 'test' });

    const headers: Record<string, string> = {};
    const context = {
      getHandler: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', socket: {} }),
        getResponse: () => ({
          set: (key: string, val: string) => {
            headers[key] = val;
          },
        }),
      }),
    } as unknown as ExecutionContext;

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('5');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('throws 429 when count exceeds configured max', async () => {
    const pipelineMock = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zrange: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 1],
        [null, 1],
        [null, 11], // count = 11 > max 10
        [null, ['item', String(Date.now() - 10000)]],
      ]),
    };

    mockRedis = {
      multi: jest.fn().mockReturnValue(pipelineMock),
    };

    guard = new SlidingWindowRateLimitGuard(reflector, mockRedis as Redis);
    jest.spyOn(reflector, 'get').mockReturnValue({ windowMs: 60000, max: 10, keyPrefix: 'test' });

    const headers: Record<string, string> = {};
    const context = {
      getHandler: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', socket: {} }),
        getResponse: () => ({
          set: (key: string, val: string) => {
            headers[key] = val;
          },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    expect(headers['Retry-After']).toBeDefined();
  });
});
