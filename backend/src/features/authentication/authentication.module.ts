import { CandidatePasswordChangedGuard } from './guards/candidate-password-changed.guard.js';
import { Module } from '@nestjs/common';
import { CandidateAuthenticationService } from './services/candidate-authentication.service.js';
import { CandidateSessionService } from './services/candidate-session.service.js';
import { CandidateAuthenticationController } from './controllers/candidate-authentication.controller.js';
import { CandidateSessionGuard } from './guards/candidate-session.guard.js';
import { AdminBasicAuthGuard } from './guards/admin-basic-auth.guard.js';

@Module({ controllers: [CandidateAuthenticationController], providers: [CandidateAuthenticationService, CandidateSessionService, CandidateSessionGuard, CandidatePasswordChangedGuard, AdminBasicAuthGuard], exports: [CandidateAuthenticationService, CandidateSessionService, CandidateSessionGuard, CandidatePasswordChangedGuard, AdminBasicAuthGuard] })
export class AuthenticationModule {}
