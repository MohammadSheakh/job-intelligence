import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import { CandidateLoginDto } from '../dto/candidate-login.dto.js';
import { CandidateAuthenticationService } from '../services/candidate-authentication.service.js';
import { CandidateSessionService } from '../services/candidate-session.service.js';
import { GoogleOAuthService } from '../services/google-oauth.service.js';
import { CandidateSessionGuard, type CandidateRequest } from '../guards/candidate-session.guard.js';
import { RateLimit } from '@app/common';

/**
 * HTTP boundary for candidate login, identity, password change, and logout; password-change gating
 * intentionally excludes these routes.
 */
@Controller('candidate-auth')
export class CandidateAuthenticationController {
  constructor(
    private readonly authentication: CandidateAuthenticationService,
    private readonly sessions: CandidateSessionService,
    private readonly googleAuth: GoogleOAuthService,
  ) {}

  /**
   * Issue an HTTP-only session cookie after password verification and tell the UI whether an
   * initial password change is required. Rate limited to 10 requests / minute.
   */
  @Post('login')
  @RateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'auth_login' })
  async login(
    @Body()
    input: CandidateLoginDto,
    @Res({ passthrough: true })
    response: Response,
  ): Promise<{ expiresAt: string; mustChangePassword: boolean }> {
    const candidate = await this.authentication.authenticate(input.email, input.password);
    if (!candidate)
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    const session = this.sessions.create(candidate.id, candidate.tokenVersion ?? 1);
    response.cookie('ji_candidate_session', session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      expires: session.expiresAt,
      path: '/',
    });
    return {
      expiresAt: session.expiresAt.toISOString(),
      mustChangePassword: candidate.mustChangePassword,
    };
  }

  /** Expose the active principal with a string ID and no credential material. */
  @Get('me')
  @UseGuards(CandidateSessionGuard)
  async me(
    @Req()
    request: CandidateRequest,
  ): Promise<{ id: string; name: string; email: string; mustChangePassword: boolean }> {
    const candidate = request.candidate;
    return {
      id: candidate.id.toString(),
      name: candidate.name,
      email: candidate.email,
      mustChangePassword: candidate.mustChangePassword,
    };
  }

  /**
   * Change only the authenticated candidate’s password; request input cannot select another
   * account. Automatically revokes all existing sessions.
   */
  @Post('change-password')
  @UseGuards(CandidateSessionGuard)
  @RateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'auth_change_pw' })
  async changePassword(
    @Req()
    request: CandidateRequest,
    @Body()
    input: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    const candidate = request.candidate;
    await this.authentication.changePassword(candidate.id, input.password);
    return { ok: true };
  }

  /** Expire the browser cookie; optionally pass ?revoke=true to revoke all server sessions. */
  @Post('logout')
  async logout(
    @Req()
    request: Request,
    @Res({ passthrough: true })
    response: Response,
  ): Promise<{ ok: true }> {
    const shouldRevoke =
      (request as Request & { query?: { revoke?: string } }).query?.revoke === 'true';
    if (shouldRevoke) {
      const token =
        request.headers.cookie
          ?.split(';')
          .map((part) => part.trim())
          .find((part) => part.startsWith('ji_candidate_session='))
          ?.slice(21) ?? '';
      if (token) {
        try {
          const decodedToken = decodeURIComponent(token);
          const sessionPayload = this.sessions.verifyPayload(decodedToken);
          if (sessionPayload) {
            await this.authentication.revokeSessions(sessionPayload.candidateId);
          }
        } catch {
          // Ignore decoding errors on logout
        }
      }
    }
    response.cookie('ji_candidate_session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      expires: new Date(0),
      path: '/',
    });
    return { ok: true };
  }

  /** Explicitly invalidate all active session tokens on the server for the current candidate. */
  @Post('revoke')
  @UseGuards(CandidateSessionGuard)
  @RateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'auth_revoke' })
  async revoke(
    @Req()
    request: CandidateRequest,
  ): Promise<{ ok: true }> {
    await this.authentication.revokeSessions(request.candidate.id);
    return { ok: true };
  }

  /** Expose whether Google OAuth is configured and available. */
  @Get('google/status')
  googleStatus(): { enabled: boolean } {
    return { enabled: this.googleAuth.isEnabled() };
  }

  /**
   * Initiate Google OAuth flow: sets a short-lived anti-forgery state cookie and redirects
   * to Google's consent screen.
   */
  @Get('google/start')
  @RateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'auth_google_start' })
  googleStart(
    @Res()
    response: Response,
  ): void {
    const frontend = this.getFrontendOrigin();
    if (!this.googleAuth.isEnabled()) {
      response.redirect(`${frontend}/candidate/login?error=Google+login+is+not+configured`);
      return;
    }

    const state = randomBytes(24).toString('base64url');
    response.cookie('ji_google_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 600_000,
      path: '/',
    });
    response.redirect(this.googleAuth.getAuthorizationUrl(state));
  }

  /**
   * Handle the OAuth redirect from Google: verify state, exchange code, bind candidate,
   * set session cookie, and redirect to the candidate portal.
   */
  @Get('google/callback')
  @RateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'auth_google_callback' })
  async googleCallback(
    @Req()
    request: Request,
    @Res()
    response: Response,
    @Query('state')
    state?: string,
    @Query('code')
    code?: string,
    @Query('error')
    errorParam?: string,
  ): Promise<void> {
    const frontend = this.getFrontendOrigin();
    const cookieState = this.parseCookie(request.headers.cookie, 'ji_google_state');

    const clearStateCookie = () => {
      response.cookie('ji_google_state', '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: 0,
        path: '/',
      });
    };

    if (errorParam) {
      clearStateCookie();
      response.redirect(`${frontend}/candidate/login?error=${encodeURIComponent(errorParam)}`);
      return;
    }

    if (!state || !cookieState || state !== cookieState) {
      clearStateCookie();
      response.redirect(`${frontend}/candidate/login?error=Invalid%20OAuth%20state`);
      return;
    }

    if (!code) {
      clearStateCookie();
      response.redirect(`${frontend}/candidate/login?error=Missing%20authorization%20code`);
      return;
    }

    let googleUser;
    try {
      googleUser = await this.googleAuth.exchangeCode(code);
    } catch {
      clearStateCookie();
      response.redirect(
        `${frontend}/candidate/login?error=Failed%20to%20exchange%20Google%20login%20token`,
      );
      return;
    }

    const candidate = await this.authentication.findOrBindGoogleCandidate({
      email: googleUser.email,
      sub: googleUser.sub,
    });

    if (!candidate) {
      response.cookie('ji_google_state', '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: 0,
        path: '/',
      });
      response.redirect(
        `${frontend}/candidate/login?error=Your+Google+email+is+not+an+active+candidate+account`,
      );
      return;
    }

    const session = this.sessions.create(candidate.id, candidate.tokenVersion ?? 1);
    response.cookie('ji_candidate_session', session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      expires: session.expiresAt,
      path: '/',
    });
    response.cookie('ji_google_state', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 0,
      path: '/',
    });

    const destination = candidate.mustChangePassword
      ? `${frontend}/candidate/change-password`
      : `${frontend}/candidate`;
    response.redirect(destination);
  }

  private parseCookie(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;
    const prefix = `${name}=`;
    const part = cookieHeader
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(prefix));
    if (!part) return null;
    try {
      return decodeURIComponent(part.slice(prefix.length));
    } catch {
      return null;
    }
  }

  private getFrontendOrigin(): string {
    const raw = process.env.FRONTEND_ORIGIN?.trim();
    if (raw) return raw.split(',')[0].trim().replace(/\/$/, '');
    return 'http://localhost:3000';
  }
}
