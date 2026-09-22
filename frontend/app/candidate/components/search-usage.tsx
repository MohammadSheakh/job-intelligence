'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../../lib/api';

interface SearchUsage {
  used: number;
  dailyLimit: number;
  remaining: number;
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
}

interface QuickSearchResult {
  mode: 'STANDARD';
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

  async function runQuickSearch() {
    setRunning(true);
    setError('');
    setRunOutcome(null);
    try {
      const result = await api<QuickSearchResult>('/candidate/quick-search/execute', {
        method: 'POST',
        body: JSON.stringify({ mode: 'STANDARD' }),
      });
      setUsage(result.usage);
      const failureNote =
        result.crawlFailures > 0 ? ` (${result.crawlFailures} checks had issues)` : '';
      const summary = `Checked ${result.companiesChecked} companies${failureNote}; found ${result.jobsFound} vacancies.`;
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
    <section className="card" aria-labelledby="search-usage-heading">
      <h2 id="search-usage-heading">Quick Search</h2>
      <p>
        Perform an on-demand check of monitor-ready companies relevant to your profile, discovering
        vacancies without waiting for the daily crawl.
      </p>
      {usage && (
        <p>
          <strong>{usage.remaining}</strong> of {usage.dailyLimit} daily searches remaining. Resets
          at{' '}
          <time dateTime={usage.resetsAt}>
            {new Date(usage.resetsAt).toLocaleString('en-GB', {
              timeZone: 'Asia/Dhaka',
              hour: '2-digit',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
            })}
          </time>{' '}
          (Dhaka).
        </p>
      )}
      {!usage && !error && <p role="status">Loading search allowance…</p>}

      {usage && (
        <button disabled={running || usage.remaining === 0} onClick={() => void runQuickSearch()}>
          {running ? 'Running Quick Search…' : 'Run Quick Search'}
        </button>
      )}

      {running && (
        <p role="status" className="muted mt-3">
          Checking shortlisted companies and updating vacancies…
        </p>
      )}

      {error && (
        <div role="alert">
          <p className="error">{error}</p>
          <button className="secondary" onClick={() => setRevision((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}

      {runOutcome && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="success font-medium" role="status">
            {runOutcome.summary}
          </p>

          <div className="results mt-4">
            {runOutcome.matches.map((match) => {
              const website = webUrl(match.companyWebsiteUrl);
              const application = webUrl(match.applicationUrl);
              const isSaving = savingCompanyId === match.companyId;

              return (
                <article className="card" key={match.jobId}>
                  <h3>{match.title}</h3>
                  <p>
                    {website ? (
                      <a href={website} target="_blank" rel="noopener noreferrer">
                        {match.companyName} ↗
                      </a>
                    ) : (
                      match.companyName
                    )}
                  </p>
                  <p>
                    {match.location ?? 'Location not listed'}
                    {match.workMode ? ` · ${match.workMode}` : ''} · Match score: {match.score}/100
                  </p>
                  <p className="tags">{match.categories.join(' · ')}</p>
                  {match.reasons.length > 0 && (
                    <ul>
                      {match.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  {match.trackingStatus && (
                    <p role="status">
                      {match.trackingStatus === 'APPLIED'
                        ? 'Applied'
                        : match.trackingStatus === 'PLANNING'
                          ? 'Planning'
                          : match.trackingStatus}
                    </p>
                  )}
                  <div className="company-actions">
                    {application && (
                      <a href={application} target="_blank" rel="noopener noreferrer">
                        Apply ↗
                      </a>
                    )}
                    <button
                      disabled={isSaving || match.trackingStatus === 'PLANNING'}
                      onClick={() => void trackCompany(match.companyId, 'PLANNING')}
                    >
                      Plan
                    </button>
                    <button
                      disabled={isSaving || match.trackingStatus === 'APPLIED'}
                      onClick={() => void trackCompany(match.companyId, 'APPLIED')}
                    >
                      Applied
                    </button>
                    <button
                      className="secondary"
                      disabled={isSaving}
                      onClick={() => void trackCompany(match.companyId, 'EXCLUDED')}
                    >
                      Blacklist
                    </button>
                  </div>
                </article>
              );
            })}

            {runOutcome.matches.length === 0 && (
              <p className="muted">No matching open vacancies were found in this search.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
