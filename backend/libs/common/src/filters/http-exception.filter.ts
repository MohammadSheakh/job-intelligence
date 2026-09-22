import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Standardizes API error responses and sanitizes unexpected internal errors to prevent
 * database structures, queries, or credentials from leaking to clients.
 */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request?.url ?? '';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const rawResponse = exception.getResponse();

      if (typeof rawResponse === 'object' && rawResponse !== null) {
        const payload = rawResponse as Record<string, unknown>;

        // Preserve existing contract for code/message errors
        if ('code' in payload && 'message' in payload) {
          response.status(status).json({
            ...payload,
            timestamp,
            path,
          });
          return;
        }

        // Handle class-validator ValidationPipe standard format
        if (Array.isArray(payload.message)) {
          response.status(status).json({
            code: 'VALIDATION_ERROR',
            message: 'Validation failed.',
            errors: payload.message,
            timestamp,
            path,
          });
          return;
        }

        response.status(status).json({
          code: 'HTTP_ERROR',
          ...payload,
          timestamp,
          path,
        });
        return;
      }

      response.status(status).json({
        code: 'HTTP_ERROR',
        message: String(rawResponse),
        timestamp,
        path,
      });
      return;
    }

    // Unhandled exception: log detailed error internally, emit sanitized 500 to client
    const errorMessage = exception instanceof Error ? exception.message : 'Unknown internal error';
    const errorStack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(`Unhandled Exception at ${path}: ${errorMessage}`, errorStack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred.',
      timestamp,
      path,
    });
  }
}
