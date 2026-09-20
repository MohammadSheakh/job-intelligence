import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { CandidateSessionGuard, type CandidateRequest } from '../../authentication/guards/candidate-session.guard.js';
import { CandidateCompanyQueryDto } from '../dto/candidate-company-query.dto.js';
import { CandidateCompanyService } from '../services/candidate-company.service.js';
@Controller('candidate/companies') @UseGuards(CandidateSessionGuard)
export class CandidateCompanyController {
  constructor(private readonly companies: CandidateCompanyService) {}
  @Get() list(@Req() request: CandidateRequest, @Query() query: CandidateCompanyQueryDto) { return this.companies.list(request.candidate.id, query); }
}
