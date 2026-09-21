import { CandidatePasswordChangedGuard } from '../../authentication/guards/candidate-password-changed.guard.js';
import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  CandidateSessionGuard,
  type CandidateRequest,
} from '../../authentication/guards/candidate-session.guard.js';
import { SaveCompanyStateDto } from '../dto/save-company-state.dto.js';
import { CandidatePipelineService } from '../services/candidate-pipeline.service.js';
import { CandidatePipelineQueryDto } from '../dto/candidate-pipeline-query.dto.js';
@Controller('candidate/pipeline')
@UseGuards(CandidateSessionGuard, CandidatePasswordChangedGuard)
export class CandidatePipelineController {
  constructor(private readonly pipeline: CandidatePipelineService) {}

  @Get()
  list(
    @Req()
    request: CandidateRequest,
    @Query()
    query: CandidatePipelineQueryDto,
  ) {
    return this.pipeline.list(request.candidate.id, query.status);
  }

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
