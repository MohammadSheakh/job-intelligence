import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { CompanyListQueryDto } from '../dto/company-list-query.dto.js';
import { UpdateCompanyDto } from '../dto/update-company.dto.js';
import { CompanyIntelligenceService } from '../services/company-intelligence.service.js';

@Controller('admin/companies')
@UseGuards(AdminBasicAuthGuard)
export class AdminCompaniesController {
  constructor(private readonly companies: CompanyIntelligenceService) {}

  @Get()
  list(
    @Query()
    query: CompanyListQueryDto,
  ) {
    return this.companies.list(query);
  }

  @Get(':id')
  get(
    @Param('id')
    id: string,
  ) {
    return this.companies.getById(id);
  }

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
