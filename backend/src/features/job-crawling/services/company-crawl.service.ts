import { Injectable } from '@nestjs/common';
import type { CompanyForCrawl } from '../domain/types.js';
import { resolveCareerUrl } from '../domain/source-overrides.js';
import { CareerPageFetcherService, CrawlTransportError } from './career-page-fetcher.service.js';
import { CrawlIngestionService } from './crawl-ingestion.service.js';

export interface CompanyCrawlOutcome {
  companyId: string;
  success: boolean;
  jobsFound: number;
  errorCode?: string;
}

/** Shared single-company orchestration for daily runs and forthcoming Quick Search execution. */
@Injectable()
export class CompanyCrawlService {
  constructor(
    private readonly fetcher: CareerPageFetcherService,
    private readonly ingestion: CrawlIngestionService,
  ) {}

  /** Fetch outside database transactions; persist sanitized failures and propagate logging failures. */
  async crawl(
    company: CompanyForCrawl,
    assertCanPersist: () => Promise<void> = async () => {},
  ): Promise<CompanyCrawlOutcome> {
    let stage = 'FETCH';
    try {
      const page = await this.fetcher.fetch(resolveCareerUrl(company.id, company.careerUrl));
      await assertCanPersist();
      stage = 'INGEST';
      const result = await this.ingestion.ingest(company.id, page);
      return { companyId: company.id, success: true, jobsFound: result.jobsFound };
    } catch (error) {
      // A lost run lock must stop the runner, rather than create another company failure record.
      await assertCanPersist();
      const code = error instanceof CrawlTransportError ? error.code : `${stage}_FAILURE`;
      const message =
        error instanceof CrawlTransportError
          ? error.message
          : 'Career page could not be processed.';
      await this.ingestion.recordFailure(company.id, `${code}: ${message}`);
      return { companyId: company.id, success: false, jobsFound: 0, errorCode: code };
    }
  }
}
