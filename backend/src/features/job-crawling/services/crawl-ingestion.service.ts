import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { parseCareerPage } from '../domain/career-page.parser.js';
import { createJobHash, normalizeLocation, normalizeTitle } from '../domain/normalize.js';
import type { CareerPage } from '../domain/types.js';

/** Persists a parsed career page atomically; fetching and scheduling belong to the caller. */
@Injectable()
export class CrawlIngestionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse before opening the transaction. Upsert at most 150 jobs using legacy hashes,
   * then commit the company check timestamp and success log with the same writes.
   * An empty/no-openings result never closes existing jobs after one missing crawl.
   */
  async ingest(companyId: string, page: CareerPage) {
    const result = parseCareerPage(companyId, page);
    const checkedAt = new Date();
    await this.prisma.$transaction(
      async (transaction) => {
        // Updating first serializes persistence for this company without holding a lock during HTTP.
        const company = await transaction.company.updateMany({
          where: { id: companyId, active: true, recommended_action: 'MONITOR_READY' },
          data: { last_checked_at: checkedAt },
        });
        if (company.count !== 1)
          throw new NotFoundException('Company is not available for monitoring.');
        for (const job of result.jobs) {
          const values = {
            title: normalizeTitle(job.title),
            location: normalizeLocation(job.location) ?? null,
            application_url: job.applicationUrl,
            status: 'OPEN',
            last_seen_at: checkedAt,
          };
          const jobHash = createJobHash(job);
          await transaction.job.upsert({
            where: { jobHash },
            create: {
              ...values,
              companyId,
              jobHash,
              description: job.description ?? null,
              first_seen_at: checkedAt,
            },
            // Missing descriptions must not erase previously extracted content.
            update: { ...values, description: job.description ?? undefined },
          });
        }
        await transaction.crawlLog.create({
          data: {
            company_id: companyId,
            checked_at: checkedAt,
            success: true,
            jobs_found: result.jobs.length,
          },
        });
      },
      { maxWait: 5000, timeout: 30000 },
    );
    return {
      companyId,
      jobsFound: result.jobs.length,
      checkedAt: checkedAt.toISOString(),
      finalUrl: result.finalUrl,
      httpStatus: result.httpStatus,
      pageHash: result.pageHash,
      noOpeningsSignal: result.noOpeningsSignal,
    };
  }

  /** Record a failed attempt without changing jobs; caller supplies a sanitized diagnostic. */
  async recordFailure(companyId: string, message: string): Promise<void> {
    const checkedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const company = await transaction.company.updateMany({
        where: { id: companyId },
        data: { last_checked_at: checkedAt },
      });
      if (company.count !== 1) throw new NotFoundException('Company was not found.');
      await transaction.crawlLog.create({
        data: {
          company_id: companyId,
          checked_at: checkedAt,
          success: false,
          jobs_found: 0,
          error: message.trim().slice(0, 2000) || 'Career page could not be processed.',
        },
      });
    });
  }
}
