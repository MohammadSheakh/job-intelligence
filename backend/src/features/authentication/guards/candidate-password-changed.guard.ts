import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { CandidateRequest } from './candidate-session.guard.js';

/** Run after CandidateSessionGuard on candidate portal routes. */
@Injectable()
export class CandidatePasswordChangedGuard implements CanActivate {
  /**
   * Require a completed initial password change after CandidateSessionGuard has populated the
   * principal.
   */
  canActivate(context: ExecutionContext): boolean {
    const { candidate } = context.switchToHttp().getRequest<CandidateRequest>();
    if (candidate.mustChangePassword) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Change your password before continuing.',
      });
    }
    return true;
  }
}
