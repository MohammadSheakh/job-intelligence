import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { CandidateRecommendationsService } from './services/candidate-recommendations.service.js';
import { AiMatchEnhancerService } from './services/ai-match-enhancer.service.js';

/** Owns deterministic ranking and optional AI match enhancement; HTTP authorization belongs to consuming modules. */
@Module({
  imports: [SettingsModule],
  providers: [CandidateRecommendationsService, AiMatchEnhancerService],
  exports: [CandidateRecommendationsService, AiMatchEnhancerService],
})
export class MatchingModule {}
