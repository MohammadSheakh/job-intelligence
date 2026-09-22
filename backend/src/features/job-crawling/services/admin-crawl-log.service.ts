import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';
import { CrawlLogListQueryDto } from '../dto/crawl-log-list-query.dto.js';

/** Exposes read-only crawler history for logs still linked to a company. */
@Injectable()
export class AdminCrawlLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Exclude unlinked logs and paginate newest first with an ID tie-breaker for equal timestamps.
   */
  async list(input: CrawlLogListQueryDto) {
    const where: Prisma.CrawlLogWhereInput = {
      company_id: { not: null },
      ...(input.success !== undefined ? { success: input.success } : {}),
      ...(input.search?.trim()
        ? {
            companies: {
              name: { contains: input.search.trim(), mode: 'insensitive' as const },
            },
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.crawlLog.count({ where }),
      this.prisma.crawlLog.findMany({
        where,
        orderBy: [{ checked_at: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          company_id: true,
          checked_at: true,
          success: true,
          jobs_found: true,
          http_status: true,
          duration_ms: true,
          crawler_type: true,
          jobs_created: true,
          jobs_updated: true,
          action_taken: true,
          error: true,
          companies: {
            select: {
              name: true,
              careerUrl: true,
              website_url: true,
              recommended_action: true,
            },
          },
        },
      }),
    ]);
    return {
      total,
      page: input.page,
      pageSize: input.pageSize,
      rows: rows
        .filter((row) => row.companies)
        .map((row) => ({
          id: row.id.toString(),
          companyId: row.company_id!,
          companyName: row.companies!.name,
          careerUrl: row.companies!.careerUrl,
          websiteUrl: row.companies!.website_url,
          recommendedAction: row.companies!.recommended_action,
          checkedAt: row.checked_at,
          success: row.success,
          jobsFound: row.jobs_found,
          httpStatus: row.http_status,
          durationMs: row.duration_ms,
          crawlerType: row.crawler_type,
          jobsCreated: row.jobs_created,
          jobsUpdated: row.jobs_updated,
          actionTaken: row.action_taken,
          error: row.error,
        })),
    };
  }
}
