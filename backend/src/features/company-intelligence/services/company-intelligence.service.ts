import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CareerPageFetcherService } from '../../job-crawling/services/career-page-fetcher.service.js';
import { CompanyListQueryDto } from '../dto/company-list-query.dto.js';
import { CreateCompanyDto } from '../dto/create-company.dto.js';
import { EnrichCompanyDto } from '../dto/enrich-company.dto.js';
import { UpdateCompanyDto } from '../dto/update-company.dto.js';

/** Implements administrator company browsing, creation, review completion, and enrichment. */
@Injectable()
export class CompanyIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: CareerPageFetcherService,
  ) {}

  /** Apply validated filters and pagination, returning matching rows and their total count. */
  async list(input: CompanyListQueryDto) {
    const search = input.search?.trim();
    const category = input.category?.trim();
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { website_url: { contains: search, mode: 'insensitive' as const } },
              { location: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(input.action ? { recommended_action: input.action } : {}),
      ...(category ? { categories: { some: { category: { name: category } } } } : {}),
      ...(input.needsManualReview !== undefined
        ? { needs_manual_review: input.needsManualReview }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: this.companyListSelect,
      }),
    ]);
    return {
      total,
      page: input.page,
      pageSize: input.pageSize,
      rows: rows.map((company) => this.toCompanySummary(company)),
    };
  }

  /** Return company details or a domain 404, normalizing category placeholders for display. */
  async getById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        ...this.companyListSelect,
        notes: true,
        status_research_hint: true,
        needs_enrichment: true,
        enrichment_reasons: true,
        source_rows: true,
        name_source: true,
      },
    });
    if (!company)
      throw new NotFoundException({ code: 'COMPANY_NOT_FOUND', message: 'Company was not found.' });
    return {
      ...this.toCompanySummary(company),
      notes: company.notes,
      statusResearchHint: company.status_research_hint,
      needsEnrichment: company.needs_enrichment,
      enrichmentReasons: company.enrichment_reasons,
      sourceRows: company.source_rows,
      nameSource: company.name_source,
    };
  }

  /** Create a new company profile with categories and initial research status. */
  async create(input: CreateCompanyDto): Promise<{ id: string; name: string }> {
    const name = input.name.trim();
    if (!name)
      throw new BadRequestException({
        code: 'COMPANY_NAME_REQUIRED',
        message: 'Company name is required.',
      });

    const clean = (value: string | undefined) => value?.trim() || null;
    const careerUrl = clean(input.careerUrl);
    const websiteUrl = clean(input.websiteUrl);
    const linkedinUrl = clean(input.linkedinUrl);

    let recommendedAction = input.recommendedAction ?? null;
    if (!recommendedAction) {
      if (careerUrl) {
        recommendedAction = 'MONITOR_READY';
      } else if (websiteUrl) {
        recommendedAction = 'FIND_CAREER_PAGE';
      } else if (linkedinUrl) {
        recommendedAction = 'ENRICH_FROM_LINKEDIN';
      } else {
        recommendedAction = 'NO_HIRING_PAGE_FOUND';
      }
    }

    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    const prefix = baseSlug ? `c_${baseSlug}` : 'c_company';
    let id = prefix;
    const existing = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });
    if (existing) {
      id = `${prefix}_${Date.now().toString(36)}`;
    }

    const names = [
      ...new Set((input.categories ?? []).map((category) => category.trim()).filter(Boolean)),
    ];
    const requested = names.length ? names : ['Other'];
    const categories = await this.prisma.category.findMany({
      where: { name: { in: requested } },
      select: { id: true },
    });
    if (categories.length !== requested.length)
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'One or more categories were not found.',
      });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.company.create({
        data: {
          id,
          name,
          website_url: websiteUrl,
          careerUrl: careerUrl,
          linkedin_url: linkedinUrl,
          email: clean(input.email),
          location: clean(input.location),
          tech_stack: clean(input.techStack),
          notes: clean(input.notes),
          recommended_action: recommendedAction,
          status_research_hint: clean(input.statusResearchHint),
          active: input.active ?? true,
          needs_manual_review: input.needsManualReview ?? false,
          review_reasons: clean(input.reviewReasons),
          needs_enrichment: recommendedAction === 'ENRICH_FROM_LINKEDIN',
          enrichment_reasons:
            recommendedAction === 'ENRICH_FROM_LINKEDIN'
              ? 'Awaiting official website or career URL enrichment'
              : null,
        },
      });
      await transaction.companyCategory.createMany({
        data: categories.map((category) => ({
          companyId: id,
          categoryId: category.id,
          source: 'admin',
        })),
      });
    });

    return { id, name };
  }

  /**
   * Complete manual review: clears review flag, review reasons, and recalculates recommended action.
   */
  async completeReview(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, website_url: true, careerUrl: true },
    });
    if (!company)
      throw new NotFoundException({
        code: 'COMPANY_NOT_FOUND',
        message: 'Company was not found.',
      });

    let recommendedAction = 'NO_HIRING_PAGE_FOUND';
    if (company.careerUrl?.trim()) {
      recommendedAction = 'MONITOR_READY';
    } else if (company.website_url?.trim()) {
      recommendedAction = 'FIND_CAREER_PAGE';
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        needs_manual_review: false,
        review_reasons: null,
        recommended_action: recommendedAction,
        updated_at: new Date(),
      },
      select: {
        id: true,
        name: true,
        recommended_action: true,
        needs_manual_review: true,
      },
    });

    return {
      ok: true,
      id: updated.id,
      name: updated.name,
      recommendedAction: updated.recommended_action,
      needsManualReview: updated.needs_manual_review,
    };
  }

  /**
   * Controlled enrichment: inspects official website for career page without bypassing LinkedIn
   * anti-bot controls, transitioning status to MONITOR_READY or FIND_CAREER_PAGE.
   */
  async enrich(id: string, input?: EnrichCompanyDto) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        website_url: true,
        careerUrl: true,
        linkedin_url: true,
      },
    });
    if (!company)
      throw new NotFoundException({
        code: 'COMPANY_NOT_FOUND',
        message: 'Company was not found.',
      });

    const clean = (v?: string) => v?.trim() || null;
    const websiteUrl = clean(input?.websiteUrl) ?? company.website_url;
    let careerUrl = clean(input?.careerUrl) ?? company.careerUrl;
    let discoveredFromHtml = false;

    if (!careerUrl && websiteUrl) {
      try {
        const page = await this.fetcher.fetch(websiteUrl);
        const candidateCareerLink = this.extractCareerLink(page.html, page.finalUrl);
        if (candidateCareerLink) {
          careerUrl = candidateCareerLink;
          discoveredFromHtml = true;
        }
      } catch {
        // Continue with websiteUrl if homepage fetch fails
      }
    }

    let recommendedAction = 'NO_HIRING_PAGE_FOUND';
    if (careerUrl) {
      recommendedAction = 'MONITOR_READY';
    } else if (websiteUrl) {
      recommendedAction = 'FIND_CAREER_PAGE';
    } else if (company.linkedin_url) {
      recommendedAction = 'ENRICH_FROM_LINKEDIN';
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        website_url: websiteUrl,
        careerUrl: careerUrl,
        recommended_action: recommendedAction,
        needs_enrichment: recommendedAction === 'ENRICH_FROM_LINKEDIN',
        enrichment_reasons:
          recommendedAction === 'ENRICH_FROM_LINKEDIN'
            ? 'Awaiting official website or career URL enrichment'
            : null,
        updated_at: new Date(),
      },
      select: {
        id: true,
        name: true,
        website_url: true,
        careerUrl: true,
        recommended_action: true,
        needs_enrichment: true,
      },
    });

    return {
      ok: true,
      id: updated.id,
      name: updated.name,
      websiteUrl: updated.website_url,
      careerUrl: updated.careerUrl,
      recommendedAction: updated.recommended_action,
      needsEnrichment: updated.needs_enrichment,
      discoveredFromHtml,
    };
  }

  /**
   * Validate requested categories, then update the company and replace assignments in one
   * transaction so failures leave the previous state intact.
   */
  async update(id: string, input: UpdateCompanyDto): Promise<void> {
    const name = input.name.trim();
    if (!name)
      throw new BadRequestException({
        code: 'COMPANY_NAME_REQUIRED',
        message: 'Company name is required.',
      });
    const clean = (value: string | undefined) => value?.trim() || null;
    await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.company.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing)
        throw new NotFoundException({
          code: 'COMPANY_NOT_FOUND',
          message: 'Company was not found.',
        });
      const names = [
        ...new Set(input.categories.map((category) => category.trim()).filter(Boolean)),
      ];
      const requested = names.length ? names : ['Other'];
      const categories = await transaction.category.findMany({
        where: { name: { in: requested } },
        select: { id: true },
      });
      if (categories.length !== requested.length)
        throw new NotFoundException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'One or more categories were not found.',
        });
      await transaction.company.update({
        where: { id },
        data: {
          name,
          website_url: clean(input.websiteUrl),
          careerUrl: clean(input.careerUrl),
          linkedin_url: clean(input.linkedinUrl),
          email: clean(input.email),
          location: clean(input.location),
          tech_stack: clean(input.techStack),
          notes: clean(input.notes),
          recommended_action: input.recommendedAction ?? null,
          status_research_hint: clean(input.statusResearchHint),
          active: input.active,
          updated_at: new Date(),
        },
      });
      await transaction.companyCategory.deleteMany({ where: { companyId: id } });
      await transaction.companyCategory.createMany({
        data: categories.map((category) => ({
          companyId: id,
          categoryId: category.id,
          source: 'admin',
        })),
      });
    });
  }

  private extractCareerLink(html: string, baseUrl: string): string | null {
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const careerPathRegex =
      /(careers?|jobs?|join-us|work-with-us|openings|vacanc(y|ies)|career-opportunities)(\/|$|\?)/i;
    const careerTextRegex =
      /\b(careers?|jobs?|join our team|work with us|current openings|open positions|we['’]re hiring)\b/i;

    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1]?.trim();
      const text = (match[2] ?? '').replace(/<[^>]+>/g, ' ').trim();
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        continue;
      }
      if (careerPathRegex.test(href) || careerTextRegex.test(text)) {
        try {
          const resolved = new URL(href, baseUrl);
          if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
            return resolved.href;
          }
        } catch {
          // Skip invalid URL resolutions
        }
      }
    }
    return null;
  }

  private readonly companyListSelect = {
    id: true,
    name: true,
    website_url: true,
    careerUrl: true,
    linkedin_url: true,
    email: true,
    location: true,
    tech_stack: true,
    active: true,
    recommended_action: true,
    needs_manual_review: true,
    review_reasons: true,
    last_checked_at: true,
    categories: {
      include: { category: { select: { name: true, type: true } } },
      orderBy: { category: { type: 'asc' as const } },
    },
  };

  /**
   * Translate persistence names to API fields and omit Other when a meaningful category is
   * present.
   */
  private toCompanySummary(company: {
    id: string;
    name: string;
    website_url: string | null;
    careerUrl: string | null;
    linkedin_url: string | null;
    email: string | null;
    location: string | null;
    tech_stack: string | null;
    active: boolean;
    recommended_action: string | null;
    needs_manual_review: boolean;
    review_reasons: string | null;
    last_checked_at: Date | null;
    categories: Array<{ category: { name: string } }>;
  }) {
    const categories = company.categories.map((item) => item.category.name);
    return {
      id: company.id,
      name: company.name,
      websiteUrl: company.website_url,
      careerUrl: company.careerUrl,
      linkedinUrl: company.linkedin_url,
      email: company.email,
      location: company.location,
      techStack: company.tech_stack,
      active: company.active,
      recommendedAction: company.recommended_action,
      needsManualReview: company.needs_manual_review,
      reviewReasons: company.review_reasons,
      lastCheckedAt: company.last_checked_at,
      categories:
        categories.length > 1 ? categories.filter((name) => name !== 'Other') : categories,
    };
  }
}
