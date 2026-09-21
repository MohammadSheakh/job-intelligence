import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import {
  CandidateSessionGuard,
  type CandidateRequest,
} from '../../authentication/guards/candidate-session.guard.js';
import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import { QuickSearchQuotaService } from '../../quick-search/services/quick-search-quota.service.js';

/** Exposes read-only usage; reading this endpoint never starts a crawl or consumes quota. */
@Controller('candidate/quick-search/usage')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidateSearchUsageController {
  constructor(private readonly quota: QuickSearchQuotaService) {}

  /** Scope usage to the signed-in candidate and prevent shared caching of private counts. */
  @Get()
  @Header('Cache-Control', 'private, no-store')
  get(
    @Req()
    request: CandidateRequest,
  ) {
    return this.quota.usage(request.candidate.id);
  }
}
