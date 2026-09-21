import { crawlGeneric } from '../crawler/generic.js';
import { resolveCareerUrl } from '../crawler/source-overrides.js';
import { deterministicMatch } from '../matching/matcher.js';
import { maybeEnhanceMatch } from '../ai/match-enhancer.js';
import { getActiveCandidateById } from '../repositories/candidates.js';
import { getCompaniesForQuickSearch, markCompanyChecked } from '../repositories/companies.js';
import { recordCrawlLog } from '../repositories/crawl-logs.js';
import { getOpenJobsForMatching, upsertJob } from '../repositories/jobs.js';
import { getSettings } from '../repositories/settings.js';
import {
  finishQuickSearchRun,
  reserveQuickSearch,
  type QuickSearchMode,
} from '../repositories/search-runs.js';
import type { MatchResult } from '../matching/types.js';

export interface QuickSearchMatch {
  jobId: number;
  companyId: string;
  companyName: string;
  title: string;
  location: string | null;
  applicationUrl: string | null;
  score: number;
  aiUsed: boolean;
  reasons: string[];
}

export interface QuickSearchResult {
  mode: QuickSearchMode;
  companiesChecked: number;
  crawlFailures: number;
  jobsFound: number;
  matches: QuickSearchMatch[];
  remaining: number;
  aiRemaining: number;
  aiAvailable: boolean;
  message?: string;
}

export async function runCandidateQuickSearch(
  candidateId: number,
  mode: QuickSearchMode,
): Promise<QuickSearchResult> {
  const [candidate, settings] = await Promise.all([
    getActiveCandidateById(candidateId),
    getSettings(),
  ]);
  if (!candidate) throw new Error('Candidate profile not found.');

  const aiAvailable = Boolean(
    settings.aiEnabled &&
    settings.aiMatchingEnabled &&
    settings.aiDailyLimit > 0 &&
    process.env.AI_BASE_URL &&
    process.env.AI_MODEL,
  );
  if (mode === 'AI' && !aiAvailable) {
    throw new Error(
      'AI-assisted search is not available. Ask the admin to enable/configure AI first.',
    );
  }

  const reservation = await reserveQuickSearch(
    candidateId,
    mode,
    settings.quickSearchDailyLimit,
    settings.quickSearchAiDailyLimit,
  );
  if ('reason' in reservation) {
    throw new Error(
      `${reservation.reason} Remaining today: ${reservation.usage.remaining}; AI remaining: ${reservation.usage.aiRemaining}.`,
    );
  }

  const runId = reservation.runId;
  let companiesChecked = 0;
  let crawlFailures = 0;
  let jobsFound = 0;
  try {
    const companies = await getCompaniesForQuickSearch(
      candidateId,
      candidate.preferredCategories,
      settings.quickSearchCompanyLimit,
    );
    for (const company of companies) {
      companiesChecked += 1;
      try {
        const careerUrl = resolveCareerUrl(company.id, company.careerUrl);
        const result = await crawlGeneric(company.id, careerUrl);
        jobsFound += result.jobs.length;
        for (const job of result.jobs) await upsertJob(job);
        await markCompanyChecked(company.id);
        await recordCrawlLog({
          companyId: company.id,
          success: true,
          jobsFound: result.jobs.length,
        });
      } catch (error) {
        crawlFailures += 1;
        const message = error instanceof Error ? error.message : String(error);
        await markCompanyChecked(company.id).catch(() => undefined);
        await recordCrawlLog({
          companyId: company.id,
          success: false,
          jobsFound: 0,
          error: message,
        }).catch(() => undefined);
      }
      const delayMs = Math.max(0, Number(process.env.QUICK_SEARCH_DELAY_MS ?? 350));
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const jobs = await getOpenJobsForMatching();
    const matches: QuickSearchMatch[] = [];
    const aiSettings =
      mode === 'AI' ? settings : { ...settings, aiEnabled: false, aiMatchingEnabled: false };

    for (const job of jobs) {
      const base = deterministicMatch(candidate, job);
      if (!base.eligible) continue;
      const result: MatchResult =
        mode === 'AI' ? await maybeEnhanceMatch(aiSettings, candidate, job, base) : base;
      const threshold = candidate.minimumMatchScore ?? settings.defaultMatchThreshold;
      if (result.finalScore < threshold) continue;
      matches.push({
        jobId: job.id,
        companyId: job.companyId,
        companyName: job.companyName,
        title: job.title,
        location: job.location ?? job.companyLocation ?? null,
        applicationUrl: job.applicationUrl ?? job.companyCareerUrl ?? null,
        score: result.finalScore,
        aiUsed: result.aiUsed,
        reasons: result.reasons,
      });
    }
    matches.sort((a, b) => b.score - a.score || b.jobId - a.jobId);
    const topMatches = matches.slice(0, 25);
    await finishQuickSearchRun(runId, {
      companiesChecked,
      jobsFound,
      matchesFound: topMatches.length,
      success: true,
    });
    return {
      mode,
      companiesChecked,
      crawlFailures,
      jobsFound,
      matches: topMatches,
      remaining: reservation.usage.remaining,
      aiRemaining: reservation.usage.aiRemaining,
      aiAvailable,
      message: crawlFailures
        ? `${crawlFailures} company checks failed; existing jobs were still matched.`
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishQuickSearchRun(runId, {
      companiesChecked,
      jobsFound,
      matchesFound: 0,
      success: false,
      error: message,
    }).catch(() => undefined);
    throw error;
  }
}
