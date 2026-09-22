import { Body, Controller, Get, Header, Post, Req, UseGuards } from '@nestjs/common';
import {
  CandidateSessionGuard,
  type CandidateRequest,
} from '../../authentication/guards/candidate-session.guard.js';
import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import { QuickSearchQuotaService } from '../../quick-search/services/quick-search-quota.service.js';
import { QuickSearchExecutionService } from '../../quick-search/services/quick-search-execution.service.js';
import { AiMatchEnhancerService } from '../../matching/services/ai-match-enhancer.service.js';
import { ExecuteQuickSearchDto } from '../dto/execute-quick-search.dto.js';

/** Exposes read-only usage allowance and on-demand Quick Search execution. */
@Controller('candidate/quick-search')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidateSearchUsageController {
  constructor(
    private readonly quota: QuickSearchQuotaService,
    private readonly execution: QuickSearchExecutionService,
    private readonly aiEnhancer: AiMatchEnhancerService,
  ) {}

  /** Scope usage to the signed-in candidate and prevent shared caching of private counts. */
  @Get('usage')
  @Header('Cache-Control', 'private, no-store')
  async get(
    @Req()
    request: CandidateRequest,
  ) {
    const usage = await this.quota.usage(request.candidate.id);
    const aiAvailable = await this.aiEnhancer.isAvailable();
    return {
      ...usage,
      aiAvailable,
    };
  }

  /** Run on-demand Quick Search, checking shortlisted companies and updating vacancies. */
  @Post('execute')
  async execute(
    @Req()
    request: CandidateRequest,
    @Body()
    dto: ExecuteQuickSearchDto,
  ) {
    return this.execution.execute(request.candidate.id, dto.mode);
  }
}
