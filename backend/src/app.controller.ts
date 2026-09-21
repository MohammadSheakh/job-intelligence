import { Controller, Get } from '@nestjs/common';

/**
 * Process liveness endpoint for the replacement API; it does not perform a database readiness
 * check.
 */
@Controller('health')
export class AppController {
  /** Identify the single-tenant API process without querying external services. */
  @Get()
  health(): { status: 'ok'; architecture: 'single-tenant' } {
    return { status: 'ok', architecture: 'single-tenant' };
  }
}
