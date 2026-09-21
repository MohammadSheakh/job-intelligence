import { MatchingModule } from '../matching/matching.module.js';
import { CandidateRecommendationsController } from './controllers/candidate-recommendations.controller.js';
import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { CandidateProfileController } from './controllers/candidate-profile.controller.js';
import { CandidateProfileService } from './services/candidate-profile.service.js';
import { CandidatePipelineController } from './controllers/candidate-pipeline.controller.js';
import { CandidatePipelineService } from './services/candidate-pipeline.service.js';
import { CandidateCompanyController } from './controllers/candidate-company.controller.js';
import { CandidateCompanyService } from './services/candidate-company.service.js';
import { CandidateCategoryCatalogController } from './controllers/candidate-category-catalog.controller.js';
import { CandidateCategoryCatalogService } from './services/candidate-category-catalog.service.js';

@Module({
  imports: [AuthenticationModule, MatchingModule],
  controllers: [
    CandidateRecommendationsController,
    CandidateProfileController,
    CandidatePipelineController,
    CandidateCompanyController,
    CandidateCategoryCatalogController,
  ],
  providers: [
    CandidateProfileService,
    CandidatePipelineService,
    CandidateCompanyService,
    CandidateCategoryCatalogService,
  ],
})
export class CandidatePortalModule {}
