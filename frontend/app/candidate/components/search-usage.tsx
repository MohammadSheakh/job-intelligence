'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../../lib/api';

interface SearchUsage {
  used: number;
  dailyLimit: number;
  remaining: number;
  aiUsed: number;
  aiDailyLimit: number;
  aiRemaining: number;
  aiAvailable: boolean;
  resetsAt: string;
}

interface QuickSearchMatch {
  jobId: string;
  companyId: string;
  companyName: string;
  companyWebsiteUrl: string | null;
  title: string;
  location: string | null;
  workMode: string | null;
  applicationUrl: string | null;
  score: number;
  reasons: string[];
  categories: string[];
  trackingStatus: string | null;
  aiUsed?: boolean;
}

interface QuickSearchResult {
  mode: 'STANDARD' | 'AI';
  companiesChecked: number;
  crawlFailures: number;
  jobsFound: number;
  matches: QuickSearchMatch[];
  usage: SearchUsage;
  message?: string;
}

/** Research URLs are untrusted data; only web links may become clickable actions. */
function webUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Display the persisted allowance and allow on-demand Quick Search execution. */
export function SearchUsage() {
  const router = useRouter();
  const [usage, setUsage] = useState<SearchUsage | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [running, setRunning] = useState(false);
  const [runOutcome, setRunOutcome] = useState<{
    summary: string;
    matches: QuickSearchMatch[];
  } | null>(null);
  const [savingCompanyId, setSavingCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setUsage(null);
    setError('');
    api<SearchUsage>('/candidate/quick-search/usage', { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setUsage(value);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        const destination = candidateAuthRedirect(reason);
        if (destination) router.replace(destination);
        else
          setError(reason instanceof Error ? reason.message : 'Search usage could not be loaded.');
      });
    return () => controller.abort();
  }, [revision, router]);

  async function runQuickSearch(mode: 'STANDARD' | 'AI' = 'STANDARD') {
    setRunning(true);
    setError('');
    setRunOutcome(null);
    try {
      const result = await api<QuickSearchResult>('/candidate/quick-search/execute', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      setUsage(result.usage);
      const failureNote =
        result.crawlFailures > 0 ? ` (${result.crawlFailures} checks had issues)` : '';
      const modeLabel = result.mode === 'AI' ? 'AI Quick Search' : 'Quick Search';
      const summary = `${modeLabel}: checked ${result.companiesChecked} companies${failureNote}; found ${result.jobsFound} vacancies.`;
      setRunOutcome({
        summary,
        matches: result.matches,
      });
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      else setError(reason instanceof Error ? reason.message : 'Quick Search execution failed.');
    } finally {
      setRunning(false);
    }
  }

  async function trackCompany(companyId: string, status: 'PLANNING' | 'APPLIED' | 'EXCLUDED') {
    setSavingCompanyId(companyId);
    setError('');
    try {
      await api('/candidate/pipeline/company-state', {
        method: 'POST',
        body: JSON.stringify({ companyId, status }),
      });
      setRunOutcome((current) => {
        if (!current) return null;
        return {
          ...current,
          matches:
            status === 'EXCLUDED'
              ? current.matches.filter((m) => m.companyId !== companyId)
              : current.matches.map((m) =>
                  m.companyId === companyId ? { ...m, trackingStatus: status } : m,
                ),
        };
      });
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      else
        setError(reason instanceof Error ? reason.message : 'Company status could not be saved.');
    } finally {
      setSavingCompanyId(null);
    }
  }

  return (
    <section aria-labelledby="search-usage-heading" className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 mb-0.5">On-demand refresh</p>
          <h2 id="search-usage-heading" className="text-xl font-bold tracking-tight text-neutral-950 mb-1">
            Quick job search
          </h2>
          <p className="text-xs text-neutral-500 max-w-xl">
            The scheduled crawler runs once per day. Quick Search checks up to 8 relevant companies now, then refreshes your matches.
          </p>
          {usage && (
            <div className="text-[11px] text-neutral-400 mt-1 space-y-0.5">
              <p>
                {usage.remaining} standard/total searches remaining today · {usage.aiRemaining} AI search remaining
              </p>
              {!usage.aiAvailable && (
                <p>AI-assisted search is unavailable until AI is enabled and configured.</p>
              )}
            </div>
          )}
        </div>

        {usage && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              type="button"
              disabled={running || usage.remaining === 0}
              onClick={() => void runQuickSearch('STANDARD')}
              className="btn-pill-primary text-xs px-5 py-2"
            >
              {running ? 'Searching…' : 'Quick Search'}
            </button>
            <button
              type="button"
              className="btn-pill-secondary text-xs px-5 py-2 disabled:opacity-40"
              disabled={
                running || usage.remaining === 0 || usage.aiRemaining === 0 || !usage.aiAvailable
              }
              onClick={() => void runQuickSearch('AI')}
            >
              Search with AI
            </button>
          </div>
        )}
      </div>

      {running && (
        <div className="py-6 text-center text-xs text-neutral-500">
          Checking shortlisted companies and updating vacancies…
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
          <p>{error}</p>
          <button
            type="button"
            className="btn-pill-secondary text-xs px-3 py-1"
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {runOutcome && (
        <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
          <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2" role="status">
            {runOutcome.summary}
          </p>

          <div className="grid gap-3">
            {runOutcome.matches.map((match) => {
              const website = webUrl(match.companyWebsiteUrl);
              const application = webUrl(match.applicationUrl);
              const isSaving = savingCompanyId === match.companyId;

              return (
                <article
                  className="p-4 rounded-xl border border-neutral-100 bg-white space-y-2 text-xs"
                  key={match.jobId}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-neutral-900 text-sm">{match.title}</h3>
                      <div className="flex items-center gap-2 text-neutral-500 mt-0.5">
                        {website ? (
                          <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-neutral-800 hover:underline"
                          >
                            {match.companyName} ↗
                          </a>
                        ) : (
                          <span className="font-medium text-neutral-800">{match.companyName}</span>
                        )}
                        <span>·</span>
                        <span>{match.location ?? 'Location not listed'}</span>
                        {match.workMode && (
                          <>
                            <span>·</span>
                            <span>{match.workMode}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="badge-neutral text-[11px] font-semibold">
                        Match: {match.score}%
                      </span>
                      {match.aiUsed && (
                        <span className="badge-neutral text-[11px] font-semibold bg-purple-50 text-purple-700 border-purple-100">
                          AI
                        </span>
                      )}
                    </div>
                  </div>

                  {match.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {match.categories.map((cat) => (
                        <span key={cat} className="tag-pill text-[10px]">
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-neutral-50">
                    <div>
                      {application && (
                        <a
                          href={application}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-neutral-900 hover:underline"
                        >
                          Apply ↗
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isSaving || match.trackingStatus === 'PLANNING'}
                        onClick={() => void trackCompany(match.companyId, 'PLANNING')}
                        className="btn-pill-secondary text-xs px-3 py-0.5"
                      >
                        Plan
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || match.trackingStatus === 'APPLIED'}
                        onClick={() => void trackCompany(match.companyId, 'APPLIED')}
                        className="btn-pill-primary text-xs px-3 py-0.5"
                      >
                        Applied
                      </button>
                      <button
                        type="button"
                        className="btn-pill-danger text-xs px-3 py-0.5"
                        disabled={isSaving}
                        onClick={() => void trackCompany(match.companyId, 'EXCLUDED')}
                      >
                        Blacklist
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {runOutcome.matches.length === 0 && (
              <p className="text-xs text-neutral-400 py-3 text-center">
                No matching open vacancies were found in this search.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
