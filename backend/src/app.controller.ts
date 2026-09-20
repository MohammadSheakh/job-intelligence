import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health(): { status: 'ok'; architecture: 'single-tenant' } {
    return { status: 'ok', architecture: 'single-tenant' };
  }
}
