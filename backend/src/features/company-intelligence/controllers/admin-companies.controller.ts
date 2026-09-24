import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { CompanyListQueryDto } from '../dto/company-list-query.dto.js';
import { CreateCompanyDto } from '../dto/create-company.dto.js';
import { EnrichCompanyDto } from '../dto/enrich-company.dto.js';
import { UpdateCompanyDto } from '../dto/update-company.dto.js';
import { BatchEnrichLinkedInDto } from '../dto/batch-enrich-linkedin.dto.js';
import { CompanyIntelligenceService } from '../services/company-intelligence.service.js';
import { LinkedInEnrichmentCrawlerService } from '../services/linkedin-enrichment-crawler.service.js';

/**
 * Basic-authenticated company management; creation, enrichment, review completion, and category
 * replacement rules live in the service.
 */
@Controller('admin/companies')
@UseGuards(AdminBasicAuthGuard)
export class AdminCompaniesController {
  constructor(
    private readonly companies: CompanyIntelligenceService,
    private readonly linkedInEnricher: LinkedInEnrichmentCrawlerService,
  ) {}

  /** Return count of companies pending LinkedIn enrichment. */
  @Get('enrich-linkedin/status')
  getLinkedInStatus() {
    return this.linkedInEnricher.getPendingCount();
  }

  /** Run batch LinkedIn enrichment on companies pending website/career discovery. */
  @Post('enrich-linkedin')
  batchEnrichLinkedIn(
    @Body()
    input: BatchEnrichLinkedInDto,
  ) {
    return this.linkedInEnricher.enrichPendingBatch(input);
  }

  /** Return a filtered page and total count using validated query bounds. */
  @Get()
  list(
    @Query()
    query: CompanyListQueryDto,
  ) {
    return this.companies.list(query);
  }

  /** Create a new company profile with categories and initial research status. */
  @Post()
  create(
    @Body()
    input: CreateCompanyDto,
  ) {
    return this.companies.create(input);
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

  /** Complete manual review: clears review flag and recalculates next recommended action. */
  @Post(':id/complete-review')
  completeReview(
    @Param('id')
    id: string,
  ) {
    return this.companies.completeReview(id);
  }

  /**
   * Controlled enrichment: inspects website for career page without bypassing LinkedIn anti-bot
   * controls.
   */
  @Post(':id/enrich')
  enrich(
    @Param('id')
    id: string,
    @Body()
    input: EnrichCompanyDto,
  ) {
    return this.companies.enrich(id, input);
  }

  /**
   * Enriches a single company by crawling its LinkedIn profile and discovering website & career URLs.
   */
  @Post(':id/enrich-linkedin')
  enrichLinkedIn(
    @Param('id')
    id: string,
  ) {
    return this.linkedInEnricher.enrichSingleCompany(id);
  }

  /**
   * Delete a company and its associated records.
   */
  @Delete(':id')
  async delete(
    @Param('id')
    id: string,
  ) {
    await this.companies.delete(id);
    return { ok: true, id };
  }
}
