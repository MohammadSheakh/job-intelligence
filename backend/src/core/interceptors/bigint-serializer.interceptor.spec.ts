import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { BigIntSerializerInterceptor } from '@app/common';

describe('BigIntSerializerInterceptor', () => {
  let interceptor: BigIntSerializerInterceptor;

  beforeEach(() => {
    interceptor = new BigIntSerializerInterceptor();
  });

  it('converts BigInt primitive to string', (done) => {
    const context = {} as ExecutionContext;
    const next: CallHandler = {
      handle: () => of({ id: 1234567890123456789n }),
    };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({ id: '1234567890123456789' });
      done();
    });
  });

  it('recursively converts nested BigInts in arrays and objects', (done) => {
    const context = {} as ExecutionContext;
    const next: CallHandler = {
      handle: () =>
        of({
          candidate: {
            id: 999n,
            runs: [
              { id: 1n, count: 10 },
              { id: 2n, count: 20 },
            ],
          },
          status: 'ok',
        }),
    };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({
        candidate: {
          id: '999',
          runs: [
            { id: '1', count: 10 },
            { id: '2', count: 20 },
          ],
        },
        status: 'ok',
      });
      done();
    });
  });

  it('preserves Date instances, null, and undefined values', (done) => {
    const now = new Date();
    const context = {} as ExecutionContext;
    const next: CallHandler = {
      handle: () => of({ date: now, empty: null, missing: undefined }),
    };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({ date: now, empty: null, missing: undefined });
      done();
    });
  });
});
