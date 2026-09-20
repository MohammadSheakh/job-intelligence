import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { CandidateAuthenticationService, type CandidatePrincipal } from '../services/candidate-authentication.service.js';
import { CandidateSessionService } from '../services/candidate-session.service.js';

@Injectable()
export class CandidateSessionGuard implements CanActivate {
  constructor(private readonly sessions: CandidateSessionService, private readonly authentication: CandidateAuthenticationService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { candidate?: CandidatePrincipal | null }>();
    const token = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ji_candidate_session='))?.slice(21) ?? '';
    const id = this.sessions.verify(decodeURIComponent(token));
    request.candidate = id ? await this.authentication.getActiveCandidate(id) : null;
    if (!request.candidate) throw new UnauthorizedException({ code: 'CANDIDATE_SESSION_INVALID', message: 'Candidate session is invalid or expired.' });
    return true;
  }
}
export type CandidateRequest = Request & { candidate: CandidatePrincipal };
