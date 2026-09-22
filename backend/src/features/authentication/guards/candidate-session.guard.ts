import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  CandidateAuthenticationService,
  type CandidatePrincipal,
} from '../services/candidate-authentication.service.js';
import { CandidateSessionService } from '../services/candidate-session.service.js';

/**
 * Validates the session cookie, checks token versioning against database state,
 * and attaches a freshly loaded active principal to the request.
 */
@Injectable()
export class CandidateSessionGuard implements CanActivate {
  constructor(
    private readonly sessions: CandidateSessionService,
    private readonly authentication: CandidateAuthenticationService,
  ) {}

  /**
   * Treat malformed cookie encoding or revoked token version as unauthenticated.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { candidate?: CandidatePrincipal | null }>();
    const token =
      request.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('ji_candidate_session='))
        ?.slice(21) ?? '';
    let decodedToken: string;
    try {
      decodedToken = decodeURIComponent(token);
    } catch {
      throw new UnauthorizedException({
        code: 'CANDIDATE_SESSION_INVALID',
        message: 'Candidate session is invalid or expired.',
      });
    }
    const sessionPayload = this.sessions.verifyPayload(decodedToken);
    if (!sessionPayload) {
      throw new UnauthorizedException({
        code: 'CANDIDATE_SESSION_INVALID',
        message: 'Candidate session is invalid or expired.',
      });
    }
    const candidate = await this.authentication.getActiveCandidate(sessionPayload.candidateId);
    if (!candidate) {
      throw new UnauthorizedException({
        code: 'CANDIDATE_SESSION_INVALID',
        message: 'Candidate session is invalid or expired.',
      });
    }
    if (
      candidate.tokenVersion !== undefined &&
      sessionPayload.tokenVersion !== candidate.tokenVersion
    ) {
      throw new UnauthorizedException({
        code: 'CANDIDATE_SESSION_INVALID',
        message: 'Candidate session has been revoked. Please sign in again.',
      });
    }
    request.candidate = candidate;
    return true;
  }
}
export type CandidateRequest = Request & { candidate: CandidatePrincipal };
