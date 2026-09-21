import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { SaveCandidateDto } from '../dto/save-candidate.dto.js';
import { AdminCandidatesService } from '../services/admin-candidates.service.js';

@Controller('admin/candidates')
@UseGuards(AdminBasicAuthGuard)
export class AdminCandidatesController {
  constructor(private readonly candidates: AdminCandidatesService) {}

  @Get()
  list() {
    return this.candidates.list();
  }

  @Get(':id')
  get(
    @Param('id')
    id: string,
  ) {
    return this.candidates.get(id);
  }

  @Post()
  create(
    @Body()
    input: SaveCandidateDto,
  ) {
    return this.candidates.create(input);
  }

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
