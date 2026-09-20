import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AppConfigService } from '../../../config/config.service.js';

@Injectable()
export class AdminBasicAuthGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const expected = `${this.config.app.adminUsername}:${this.config.app.adminPassword}`;
    if (!header?.startsWith('Basic ') || !this.config.app.adminUsername || !this.config.app.adminPassword) this.reject();

    let supplied: string;
    try { supplied = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { this.reject(); }
    const suppliedBuffer = Buffer.from(supplied!);
    const expectedBuffer = Buffer.from(expected);
    if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) this.reject();
    return true;
  }

  private reject(): never {
    throw new UnauthorizedException({ code: 'ADMIN_AUTH_REQUIRED', message: 'Administrator authentication is required.' });
  }
}
