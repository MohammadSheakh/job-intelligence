import { crawlConfig } from '../crawl.config.js';
import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { DailyCrawlRepository } from '../repositories/daily-crawl.repository.js';
import { CompanyCrawlService } from './company-crawl.service.js';

export interface DailyCrawlSummary {
  status: 'completed' | 'stopped' | 'already-running';
  checked: number;
  failed: number;
  skipped: number;
  jobsFound: number;
  limitReached: boolean;
}

/** Executes one bounded, paced sweep; an external scheduler owns the daily trigger. */
@Injectable()
export class DailyCrawlService {
  private readonly logger = new Logger(DailyCrawlService.name);
  private running = false;
  constructor(
    private readonly repository: DailyCrawlRepository,
    private readonly companies: CompanyCrawlService,
  ) {}

  /** Process sequentially, stop at company boundaries, and release run ownership in every exit path. */
  async run(signal: AbortSignal): Promise<DailyCrawlSummary> {
    const summary: DailyCrawlSummary = {
      status: 'completed',
      checked: 0,
      failed: 0,
      skipped: 0,
      jobsFound: 0,
      limitReached: false,
    };
    if (this.running) return { ...summary, status: 'already-running' };
    this.running = true;
    let acquired = false;
    try {
      const config = crawlConfig();
      acquired = await this.repository.acquireRunLock();
      if (!acquired) return { ...summary, status: 'already-running' };
      const upperId = await this.repository.getUpperId();
      let afterId: string | undefined;
      while (upperId && !signal.aborted && !summary.limitReached) {
        await this.repository.assertRunLock();
        const batch = await this.repository.findBatch(upperId, afterId);
        if (!batch.length) break;
        for (const company of batch) {
          if (signal.aborted || summary.limitReached) break;
          afterId = company.id;
          if (!company.careerUrl.trim()) {
            summary.skipped += 1;
            continue;
          }
          await this.repository.assertRunLock();
          const outcome = await this.companies.crawl(company, () =>
            this.repository.assertRunLock(),
          );
          summary.checked += 1;
          summary.limitReached = config.limit !== undefined && summary.checked >= config.limit;
          summary.jobsFound += outcome.jobsFound;
          if (!outcome.success) summary.failed += 1;
          // Only counters and stable error codes enter logs, never remote URLs or response content.
          this.logger.log({
            checked: summary.checked,
            success: outcome.success,
            errorCode: outcome.errorCode,
          });
          try {
            await delay(config.delayMs, undefined, { signal });
          } catch (error) {
            if (!signal.aborted) throw error;
          }
        }
        if (batch.length < 50) break;
      }
      if (signal.aborted) summary.status = 'stopped';
      return summary;
    } finally {
      try {
        if (acquired) await this.repository.releaseRunLock();
      } finally {
        this.running = false;
      }
    }
  }
}
