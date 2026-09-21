import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  CandidateSessionGuard,
  type CandidateRequest,
} from '../../authentication/guards/candidate-session.guard.js';
import { CandidateProfileService } from '../services/candidate-profile.service.js';
import { UpdateCandidateProfileDto } from '../dto/update-candidate-profile.dto.js';
@Controller('candidate/profile')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidateProfileController {
  constructor(private readonly profiles: CandidateProfileService) {}

  @Get()
  get(
    @Req()
    request: CandidateRequest,
  ) {
    return this.profiles.get(request.candidate.id);
  }

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
