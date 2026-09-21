import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { QuickSearchQuotaService } from './services/quick-search-quota.service.js';
import { QuickSearchCompanySelectorService } from './services/quick-search-company-selector.service.js';

/** Persistent quota and shortlist dependencies for the forthcoming crawler orchestrator. */
@Module({
  imports: [SettingsModule],
  providers: [QuickSearchQuotaService, QuickSearchCompanySelectorService],
  exports: [QuickSearchQuotaService, QuickSearchCompanySelectorService],
})
export class QuickSearchModule {}
