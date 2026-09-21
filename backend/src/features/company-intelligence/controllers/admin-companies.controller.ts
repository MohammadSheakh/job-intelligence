import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { CompanyListQueryDto } from '../dto/company-list-query.dto.js';
import { UpdateCompanyDto } from '../dto/update-company.dto.js';
import { CompanyIntelligenceService } from '../services/company-intelligence.service.js';

/**
 * Basic-authenticated company management; category replacement and persistence rules live in the
 * service.
 */
@Controller('admin/companies')
@UseGuards(AdminBasicAuthGuard)
export class AdminCompaniesController {
  constructor(private readonly companies: CompanyIntelligenceService) {}

  /** Return a filtered page and total count using validated query bounds. */
  @Get()
  list(
    @Query()
    query: CompanyListQueryDto,
  ) {
    return this.companies.list(query);
  }

  /** Return company details with normalized category labels. */
  @Get(':id')
  get(
    @Param('id')
    id: string,
  ) {
    return this.companies.getById(id);
  }

  /** Apply a validated company form and replace categories atomically. */
  @Put(':id')
  async update(
    @Param('id')
    id: string,
    @Body()
    input: UpdateCompanyDto,
  ) {
    await this.companies.update(id, input);
    return { ok: true };
  }
}
