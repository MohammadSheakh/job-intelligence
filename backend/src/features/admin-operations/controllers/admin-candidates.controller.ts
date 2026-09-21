import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { SaveCandidateDto } from '../dto/save-candidate.dto.js';
import { AdminCandidatesService } from '../services/admin-candidates.service.js';

/**
 * Basic-authenticated account management; DTOs validate requests and the service owns
 * normalization and transactions.
 */
@Controller('admin/candidates')
@UseGuards(AdminBasicAuthGuard)
export class AdminCandidatesController {
  constructor(private readonly candidates: AdminCandidatesService) {}

  /** Return safe administrator account summaries. */
  @Get()
  list() {
    return this.candidates.list();
  }

  /** Resolve one account using the service’s bigint validation and not-found handling. */
  @Get(':id')
  get(
    @Param('id')
    id: string,
  ) {
    return this.candidates.get(id);
  }

  /** Create an account with atomic profile and password initialization. */
  @Post()
  create(
    @Body()
    input: SaveCandidateDto,
  ) {
    return this.candidates.create(input);
  }

  /** Update a profile and optional password reset through the same transactional service. */
  @Put(':id')
  async update(
    @Param('id')
    id: string,
    @Body()
    input: SaveCandidateDto,
  ) {
    await this.candidates.update(id, input);
    return { ok: true };
  }
}
