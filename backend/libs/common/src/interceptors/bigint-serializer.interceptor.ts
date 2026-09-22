import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Recursively converts BigInt values to string representation in HTTP response payloads.
 * Prevents TypeError: Do not know how to serialize a BigInt across all API endpoints.
 */
@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => this.transform(data)));
  }

  private transform(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date || Buffer.isBuffer(value)) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item));
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.transform(val);
      }
      return result;
    }

    return value;
  }
}
