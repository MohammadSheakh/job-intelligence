import { Module } from '@nestjs/common';
import { CandidateRecommendationsService } from './services/candidate-recommendations.service.js';

/** Owns deterministic ranking; HTTP authorization belongs to the consuming portal module. */
@Module({
  providers: [CandidateRecommendationsService],
  exports: [CandidateRecommendationsService],
})
export class MatchingModule {}
