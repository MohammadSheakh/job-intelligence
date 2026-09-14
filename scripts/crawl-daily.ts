import 'dotenv/config';
import { crawlGeneric } from '../src/crawler/generic.js';
import { resolveCareerUrl } from '../src/crawler/source-overrides.js';
import { closeDb } from '../src/db.js';
import { getCompaniesForDailyCrawl, markCompanyChecked } from '../src/repositories/companies.js';
import { recordCrawlLog } from '../src/repositories/crawl-logs.js';
import { upsertJob } from '../src/repositories/jobs.js';

const limit = process.env.CRAWL_LIMIT ? Number(process.env.CRAWL_LIMIT) : undefined;
const delayMs = Number(process.env.CRAWL_DELAY_MS ?? 750);

const stats = {
  companies: 0,
  successful: 0,
  failed: 0,
  jobsDetected: 0,
  jobsInserted: 0,
  jobsUpdated: 0,
};

try {
  const companies = await getCompaniesForDailyCrawl(limit);
  stats.companies = companies.length;

  for (const company of companies) {
    try {
      const resolvedCareerUrl = resolveCareerUrl(company.id, company.careerUrl);
      const result = await crawlGeneric(company.id, resolvedCareerUrl);
      let inserted = 0;
      let updated = 0;

      for (const job of result.jobs) {
        const saved = await upsertJob(job);
        if (saved.inserted) inserted += 1;
        else updated += 1;
      }

      await markCompanyChecked(company.id);
      await recordCrawlLog({ companyId: company.id, success: true, jobsFound: result.jobs.length });

      stats.successful += 1;
      stats.jobsDetected += result.jobs.length;
      stats.jobsInserted += inserted;
      stats.jobsUpdated += updated;

      console.log(JSON.stringify({
        companyId: company.id,
        company: company.name,
        careerUrl: resolvedCareerUrl,
        finalUrl: result.finalUrl,
        jobsFound: result.jobs.length,
        inserted,
        updated,
        noOpeningsSignal: result.noOpeningsSignal,
        pageHash: result.pageHash.slice(0, 12),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stats.failed += 1;
      await markCompanyChecked(company.id).catch(() => undefined);
      await recordCrawlLog({ companyId: company.id, success: false, jobsFound: 0, error: message }).catch(() => undefined);
      console.error(JSON.stringify({ companyId: company.id, company: company.name, error: message }));
    }

    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  console.log(JSON.stringify({ summary: stats }, null, 2));
} finally {
  await closeDb();
}
