import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import type { Prisma } from '@prisma/client';
import {
  CandidateCompanyQueryDto,
  CandidateTrackingFilter,
} from '../dto/candidate-company-query.dto.js';

/**
 * Provides the active-company catalog with tracking state belonging only to the signed-in
 * candidate, supporting text search, category/location/pipeline filters, and pagination.
 */
@Injectable()
export class CandidateCompanyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply bounded search/category/location/status filters and paginate company results.
   * If page is undefined, returns flat array for backward-compatibility.
   */
  async list(candidateId: bigint, query: CandidateCompanyQueryDto) {
    const q = query.q?.trim();
    const category = query.category?.trim();
    const location = query.location?.trim();
    const status = query.status;

    const where: Prisma.CompanyWhereInput = {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { location: { contains: q, mode: 'insensitive' } },
              { tech_stack: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(category ? { categories: { some: { category: { name: category } } } } : {}),
      ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
      ...(status && status !== CandidateTrackingFilter.ALL
        ? status === CandidateTrackingFilter.UNTRACKED
          ? { candidate_company_state: { none: { candidate_id: candidateId } } }
          : {
              candidate_company_state: {
                some: { candidate_id: candidateId, status },
              },
            }
        : {}),
    };

    const pageSize = query.pageSize ?? query.limit ?? 25;
    const isPaginated = query.page !== undefined;
    const skip = isPaginated ? (query.page! - 1) * pageSize : 0;
    const take = pageSize;

    const rowsQuery = this.prisma.company.findMany({
      where,
      select: {
        id: true,
        name: true,
        website_url: true,
        careerUrl: true,
        location: true,
        categories: { include: { category: { select: { name: true } } } },
        candidate_company_state: {
          where: { candidate_id: candidateId },
          select: { status: true, last_applied_at: true, reapply_count: true, notes: true },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip,
      take,
    });
    // Legacy array consumers need no full-catalog count.
    const [total, rows] = isPaginated
      ? await this.prisma.$transaction([this.prisma.company.count({ where }), rowsQuery])
      : ([0, await rowsQuery] as const);

    const mappedRows = rows.map((row) => {
      const state = row.candidate_company_state[0];
      return {
        id: row.id,
        name: row.name,
        websiteUrl: row.website_url,
        careerUrl: row.careerUrl,
        location: row.location,
        categories: row.categories
          .map((item) => item.category.name)
          .filter((name) => name !== 'Other'),
        trackingStatus: state?.status ?? null,
        lastAppliedAt: state?.last_applied_at?.toISOString().slice(0, 10) ?? null,
        reapplyCount: state?.reapply_count ?? 0,
        notes: state?.notes ?? null,
      };
    });

    if (!isPaginated) {
      return mappedRows;
    }

    return {
      total,
      page: query.page!,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      rows: mappedRows,
    };
  }
}
