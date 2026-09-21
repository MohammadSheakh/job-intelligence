import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  CandidateSessionGuard,
  type CandidateRequest,
} from '../../authentication/guards/candidate-session.guard.js';
import { CandidateCompanyQueryDto } from '../dto/candidate-company-query.dto.js';
import { CandidateCompanyService } from '../services/candidate-company.service.js';

/** Candidate-facing company browse endpoints with bounded filters and candidate-scoped tracking. */
@Controller('candidate/companies')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidateCompanyController {
  constructor(private readonly companies: CandidateCompanyService) {}

  /** Pass the trusted principal ID and validated search options to the catalog service. */
  @Get()
  list(
    @Req()
    request: CandidateRequest,
    @Query()
    query: CandidateCompanyQueryDto,
  ) {
    return this.companies.list(request.candidate.id, query);
  }
}
