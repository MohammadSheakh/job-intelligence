import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { CandidateSessionGuard } from '../../authentication/guards/candidate-session.guard.js';
import { CandidateCategoryCatalogService } from '../services/candidate-category-catalog.service.js';
@Controller('candidate/categories')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidateCategoryCatalogController {
  constructor(private readonly catalog: CandidateCategoryCatalogService) {}

  @Get()
  list() {
    return this.catalog.list();
  }
}
