import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { CrawlExecutionModule } from '../job-crawling/crawl-execution.module.js';
import { MatchingModule } from '../matching/matching.module.js';
import { QuickSearchQuotaService } from './services/quick-search-quota.service.js';
import { QuickSearchCompanySelectorService } from './services/quick-search-company-selector.service.js';
import { QuickSearchExecutionService } from './services/quick-search-execution.service.js';

/** Persistent quota, shortlist selection, and crawler execution orchestrator for candidate quick search. */
@Module({
  imports: [SettingsModule, CrawlExecutionModule, MatchingModule],
  providers: [
    QuickSearchQuotaService,
    QuickSearchCompanySelectorService,
    QuickSearchExecutionService,
  ],
  exports: [
    QuickSearchQuotaService,
    QuickSearchCompanySelectorService,
    QuickSearchExecutionService,
  ],
})
export class QuickSearchModule {}
