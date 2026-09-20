import { Module } from '@nestjs/common';
import { CandidateAuthenticationService } from './services/candidate-authentication.service.js';
import { CandidateSessionService } from './services/candidate-session.service.js';
import { CandidateAuthenticationController } from './controllers/candidate-authentication.controller.js';
import { CandidateSessionGuard } from './guards/candidate-session.guard.js';
import { AdminBasicAuthGuard } from './guards/admin-basic-auth.guard.js';

@Module({ controllers: [CandidateAuthenticationController], providers: [CandidateAuthenticationService, CandidateSessionService, CandidateSessionGuard, AdminBasicAuthGuard], exports: [CandidateAuthenticationService, CandidateSessionService, CandidateSessionGuard, AdminBasicAuthGuard] })
export class AuthenticationModule {}
