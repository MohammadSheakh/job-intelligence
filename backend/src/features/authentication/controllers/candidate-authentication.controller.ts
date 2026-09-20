import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import { CandidateLoginDto } from '../dto/candidate-login.dto.js';
import { CandidateAuthenticationService } from '../services/candidate-authentication.service.js';
import { CandidateSessionService } from '../services/candidate-session.service.js';
import { CandidateSessionGuard, type CandidateRequest } from '../guards/candidate-session.guard.js';

@Controller('candidate-auth')
export class CandidateAuthenticationController {
  constructor(private readonly authentication: CandidateAuthenticationService, private readonly sessions: CandidateSessionService) {}
  @Post('login')
  async login(@Body() input: CandidateLoginDto, @Res({ passthrough: true }) response: Response): Promise<{ expiresAt: string; mustChangePassword: boolean }> {
    const candidate = await this.authentication.authenticate(input.email, input.password);
    if (!candidate) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    const session = this.sessions.create(candidate.id);
    response.cookie('ji_candidate_session', session.token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', expires: session.expiresAt, path: '/' });
    return { expiresAt: session.expiresAt.toISOString(), mustChangePassword: candidate.mustChangePassword };
  }
  @Get('me')
  @UseGuards(CandidateSessionGuard)
  async me(@Req() request: CandidateRequest): Promise<{ id: string; name: string; email: string; mustChangePassword: boolean }> {
    const candidate = request.candidate;
    return { id: candidate.id.toString(), name: candidate.name, email: candidate.email, mustChangePassword: candidate.mustChangePassword };
  }
  @Post('change-password')
  @UseGuards(CandidateSessionGuard)
  async changePassword(@Req() request: CandidateRequest, @Body() input: ChangePasswordDto): Promise<{ ok: true }> {
    const candidate = request.candidate;
    await this.authentication.changePassword(candidate.id, input.password);
    return { ok: true };
  }
  @Post('logout')
  @UseGuards(CandidateSessionGuard)
  logout(@Res({ passthrough: true }) response: Response): { ok: true } {
    response.cookie('ji_candidate_session', '', { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', expires: new Date(0), path: '/' });
    return { ok: true };
  }
}
