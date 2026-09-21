import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import {
  CandidateSessionGuard,
  type CandidateRequest,
} from '../../authentication/guards/candidate-session.guard.js';
import { CandidateRecommendationsService } from '../../matching/services/candidate-recommendations.service.js';
import { CandidateRecommendationQueryDto } from '../dto/candidate-recommendation-query.dto.js';

/** Exposes personalized rankings only after authentication and the initial password change. */
@Controller('candidate/recommendations')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidateRecommendationsController {
  constructor(private readonly recommendations: CandidateRecommendationsService) {}

  /** Always use the session principal; never cache another candidate's profile-derived results. */
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Req()
    request: CandidateRequest,
    @Query()
    query: CandidateRecommendationQueryDto,
  ) {
    return this.recommendations.list(request.candidate.id, query.limit);
  }
}
