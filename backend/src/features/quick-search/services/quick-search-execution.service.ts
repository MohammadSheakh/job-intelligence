import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaService } from '@app/database';
import { CompanyCrawlService } from '../../job-crawling/services/company-crawl.service.js';
import {
  CandidateRecommendationsService,
  type CandidateRecommendation,
} from '../../matching/services/candidate-recommendations.service.js';
import { QuickSearchQuotaService, type QuickSearchUsage } from './quick-search-quota.service.js';
import { QuickSearchCompanySelectorService } from './quick-search-company-selector.service.js';

export interface QuickSearchExecutionResult {
  mode: 'STANDARD';
  companiesChecked: number;
  crawlFailures: number;
  jobsFound: number;
  matches: CandidateRecommendation[];
  usage: QuickSearchUsage;
  message?: string;
}

/**
 * Orchestrates candidate on-demand search by reserving quota, checking shortlisted companies,
 * computing fresh matches, and persisting run finalization.
 */
@Injectable()
export class QuickSearchExecutionService {
  private readonly logger = new Logger(QuickSearchExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuickSearchQuotaService,
    private readonly selector: QuickSearchCompanySelectorService,
    private readonly crawler: CompanyCrawlService,
    private readonly recommendations: CandidateRecommendationsService,
  ) {}

  /**
   * Execute Standard Quick Search for an authenticated active candidate.
   * Reservations use a transaction-scoped advisory lock so quota is consumed even if crawling fails.
   */
  async execute(candidateId: bigint, mode: 'STANDARD'): Promise<QuickSearchExecutionResult> {
    const reservation = await this.quota.reserve(candidateId, mode);
    const runId = reservation.runId;
    let companiesChecked = 0;
    let crawlFailures = 0;
    let jobsFound = 0;

    try {
      const companies = await this.selector.select(candidateId);
      const delayMs = Math.max(0, Number(process.env.QUICK_SEARCH_DELAY_MS ?? 350));

      for (const company of companies) {
        companiesChecked += 1;
        try {
          const outcome = await this.crawler.crawl(company);
          jobsFound += outcome.jobsFound;
          if (!outcome.success) crawlFailures += 1;
        } catch (error) {
          crawlFailures += 1;
          this.logger.warn({
            message: 'Company crawl failed during quick search.',
            companyId: company.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (delayMs > 0 && companiesChecked < companies.length) {
          await delay(delayMs);
        }
      }

      const matches = await this.recommendations.list(candidateId, 25);

      await this.prisma.candidate_search_runs.update({
        where: { id: runId },
        data: {
          companies_checked: companiesChecked,
          jobs_found: jobsFound,
          matches_found: matches.length,
          success: true,
        },
      });

      return {
        mode,
        companiesChecked,
        crawlFailures,
        jobsFound,
        matches,
        usage: reservation.usage,
        message:
          crawlFailures > 0
            ? `${crawlFailures} company checks encountered issues; matching jobs were still updated.`
            : undefined,
      };
    } catch (error) {
      await this.prisma.candidate_search_runs
        .update({
          where: { id: runId },
          data: {
            companies_checked: companiesChecked,
            jobs_found: jobsFound,
            matches_found: 0,
            success: false,
            error:
              error instanceof Error
                ? error.message.slice(0, 1000)
                : 'Quick search execution failed.',
          },
        })
        .catch(() => undefined);
      throw error;
    }
  }
}
