import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  CandidateSessionGuard,
  type CandidateRequest,
} from '../../authentication/guards/candidate-session.guard.js';
import { SaveCompanyStateDto } from '../dto/save-company-state.dto.js';
import { CandidatePipelineService } from '../services/candidate-pipeline.service.js';
import { CandidatePipelineQueryDto } from '../dto/candidate-pipeline-query.dto.js';

/**
 * Authenticated pipeline endpoints; shared companies are never deleted by candidate tracking
 * actions.
 */
@Controller('candidate/pipeline')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidatePipelineController {
  constructor(private readonly pipeline: CandidatePipelineService) {}

  /** List the signed-in candidate’s tracking rows with an optional validated workflow filter. */
  @Get()
  list(
    @Req()
    request: CandidateRequest,
    @Query()
    query: CandidatePipelineQueryDto,
  ) {
    return this.pipeline.list(request.candidate.id, query.status);
  }

  /** Save a validated company state for the principal attached by the session guard. */
  @Post('company-state')
  async save(
    @Req()
    request: CandidateRequest,
    @Body()
    input: SaveCompanyStateDto,
  ) {
    await this.pipeline.save(request.candidate.id, input);
    return { ok: true };
  }

  /** Remove the principal’s tracking row for the selected company; repeated removal is safe. */
  @Delete(':companyId')
  async remove(
    @Req()
    request: CandidateRequest,
    @Param('companyId')
    companyId: string,
  ) {
    await this.pipeline.remove(request.candidate.id, companyId);
    return { ok: true };
  }
}
