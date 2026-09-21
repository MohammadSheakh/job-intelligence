import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CompanyListQueryDto } from '../dto/company-list-query.dto.js';
import { UpdateCompanyDto } from '../dto/update-company.dto.js';

@Injectable()
export class CompanyIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { ...this.companyListSelect, notes: true, status_research_hint: true },
    });
    if (!company)
      throw new NotFoundException({ code: 'COMPANY_NOT_FOUND', message: 'Company was not found.' });
    return {
      ...this.toCompanySummary(company),
      notes: company.notes,
      statusResearchHint: company.status_research_hint,
    };
  }

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
    last_checked_at: true,
    categories: {
      include: { category: { select: { name: true, type: true } } },
      orderBy: { category: { type: 'asc' as const } },
    },
  };

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
      lastCheckedAt: company.last_checked_at,
      categories:
        categories.length > 1 ? categories.filter((name) => name !== 'Other') : categories,
    };
  }
}
