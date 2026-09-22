import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CandidateSessionGuard,
  type CandidateRequest,
} from '../../authentication/guards/candidate-session.guard.js';
import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import { QuickSearchQuotaService } from '../../quick-search/services/quick-search-quota.service.js';
import { QuickSearchExecutionService } from '../../quick-search/services/quick-search-execution.service.js';
import { ExecuteQuickSearchDto } from '../dto/execute-quick-search.dto.js';

/** Exposes read-only usage allowance and on-demand Quick Search execution. */
@Controller('candidate/quick-search')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidateSearchUsageController {
  constructor(
    private readonly quota: QuickSearchQuotaService,
    private readonly execution: QuickSearchExecutionService,
  ) {}

  /** Scope usage to the signed-in candidate and prevent shared caching of private counts. */
  @Get('usage')
  @Header('Cache-Control', 'private, no-store')
  get(
    @Req()
    request: CandidateRequest,
  ) {
    return this.quota.usage(request.candidate.id);
  }

  /** Run on-demand Quick Search, checking shortlisted companies and updating vacancies. */
  @Post('execute')
  async execute(
    @Req()
    request: CandidateRequest,
    @Body()
    dto: ExecuteQuickSearchDto,
  ) {
    if (dto.mode === 'AI') {
      throw new BadRequestException({
        code: 'AI_SEARCH_UNAVAILABLE',
        message: 'AI-assisted search is not available. Please use Standard search.',
      });
    }
    return this.execution.execute(request.candidate.id, 'STANDARD');
  }
}
