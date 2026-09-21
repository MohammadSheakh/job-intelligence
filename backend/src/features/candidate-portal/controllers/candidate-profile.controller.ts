import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  CandidateSessionGuard,
  type CandidateRequest,
} from '../../authentication/guards/candidate-session.guard.js';
import { CandidateProfileService } from '../services/candidate-profile.service.js';
import { UpdateCandidateProfileDto } from '../dto/update-candidate-profile.dto.js';

/**
 * Authenticated self-service profile endpoints; both session and initial-password-change guards
 * run before access.
 */
@Controller('candidate/profile')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidateProfileController {
  constructor(private readonly profiles: CandidateProfileService) {}

  /** Read the profile identified by the session rather than a client-supplied candidate ID. */
  @Get()
  get(
    @Req()
    request: CandidateRequest,
  ) {
    return this.profiles.get(request.candidate.id);
  }

  /** Delegate validated non-identity fields for the signed-in candidate only. */
  @Put()
  async update(
    @Req()
    request: CandidateRequest,
    @Body()
    input: UpdateCandidateProfileDto,
  ) {
    await this.profiles.update(request.candidate.id, input);
    return { ok: true };
  }
}
