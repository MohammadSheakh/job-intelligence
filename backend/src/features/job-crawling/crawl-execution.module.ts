import { Module } from '@nestjs/common';
import { CareerPageFetcherService } from './services/career-page-fetcher.service.js';
import { CrawlIngestionService } from './services/crawl-ingestion.service.js';
import { CompanyCrawlService } from './services/company-crawl.service.js';
import { DailyCrawlService } from './services/daily-crawl.service.js';
import { DailyCrawlRepository } from './repositories/daily-crawl.repository.js';

/** Share execution providers between the API and command process without importing HTTP controllers. */
@Module({
  providers: [
    CareerPageFetcherService,
    CrawlIngestionService,
    CompanyCrawlService,
    DailyCrawlService,
    DailyCrawlRepository,
  ],
  exports: [
    CareerPageFetcherService,
    CrawlIngestionService,
    CompanyCrawlService,
    DailyCrawlService,
  ],
})
export class CrawlExecutionModule {}
