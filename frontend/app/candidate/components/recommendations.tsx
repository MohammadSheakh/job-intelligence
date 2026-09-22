'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../../lib/api';

interface Recommendation {
  jobId: string;
  companyId: string;
  companyName: string;
  companyWebsiteUrl: string | null;
  title: string;
  location: string | null;
  workMode: string | null;
  applicationUrl: string | null;
  applicationDeadline?: string | null;
  score: number;
  reasons: string[];
  categories: string[];
  trackingStatus: string | null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
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

/** Load personalized results after the parent has resolved the candidate session. */
export function Recommendations() {
  const router = useRouter();
  const [rows, setRows] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<Recommendation[]>('/candidate/recommendations', { signal: controller.signal })
      .then((results) => {
        if (!controller.signal.aborted) setRows(results);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        const destination = candidateAuthRedirect(reason);
        if (destination) router.replace(destination);
        else
          setError(
            reason instanceof Error ? reason.message : 'Recommendations could not be loaded.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision, router]);

  /** Company state applies to every recommendation from that company, not just this job. */
  async function track(companyId: string, status: 'PLANNING' | 'APPLIED' | 'EXCLUDED') {
    setSaving(true);
    setError('');
    try {
      await api('/candidate/pipeline/company-state', {
        method: 'POST',
        body: JSON.stringify({ companyId, status }),
      });
      setRows((current) =>
        status === 'EXCLUDED'
          ? current.filter((row) => row.companyId !== companyId)
          : current.map((row) =>
              row.companyId === companyId ? { ...row, trackingStatus: status } : row,
            ),
      );
      if (status === 'EXCLUDED') setRevision((value) => value + 1);
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      else
        setError(reason instanceof Error ? reason.message : 'Company status could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="recommendations-heading">
      <h2 id="recommendations-heading">Recommended jobs</h2>
      <p>
        Ranked against your profile and preferences. Browse Companies to research employers beyond
        these matches.
      </p>
      <button
        className="secondary"
        disabled={loading || saving}
        onClick={() => setRevision((value) => value + 1)}
      >
        Refresh recommendations
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Finding your best matches…</p>
      ) : (
        <div className="results">
          {rows.map((row) => {
            const website = webUrl(row.companyWebsiteUrl);
            const application = webUrl(row.applicationUrl);
            return (
              <article className="card" key={row.jobId}>
                <h3>{row.title}</h3>
                <p>
                  {website ? (
                    <a href={website} target="_blank" rel="noopener noreferrer">
                      {row.companyName} ↗
                    </a>
                  ) : (
                    row.companyName
                  )}
                </p>
                <p>
                  {row.location ?? 'Location not listed'}
                  {row.workMode ? ` · ${row.workMode}` : ''} · Match score: {row.score}/100
                </p>
                {row.applicationDeadline && (
                  <p className="text-xs text-slate-600">
                    Application deadline: {formatDate(row.applicationDeadline)}
                  </p>
                )}
                <p className="tags">{row.categories.join(' · ')}</p>
                {row.reasons.length > 0 && (
                  <ul>
                    {row.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
                {row.trackingStatus && (
                  <p role="status">
                    {row.trackingStatus === 'APPLIED'
                      ? 'Applied'
                      : row.trackingStatus === 'PLANNING'
                        ? 'Planning'
                        : row.trackingStatus}
                  </p>
                )}
                <div className="company-actions">
                  {application && (
                    <a href={application} target="_blank" rel="noopener noreferrer">
                      Apply ↗
                    </a>
                  )}
                  <button
                    disabled={saving || row.trackingStatus === 'PLANNING'}
                    onClick={() => void track(row.companyId, 'PLANNING')}
                  >
                    Plan
                  </button>
                  <button
                    disabled={saving || row.trackingStatus === 'APPLIED'}
                    onClick={() => void track(row.companyId, 'APPLIED')}
                  >
                    Applied
                  </button>
                  <button
                    className="secondary"
                    disabled={saving}
                    onClick={() => void track(row.companyId, 'EXCLUDED')}
                  >
                    Blacklist
                  </button>
                </div>
              </article>
            );
          })}
          {!error && rows.length === 0 && (
            <p>
              No jobs currently meet your preferences and minimum score.{' '}
              <Link href="/candidate/profile">Review your profile</Link> or{' '}
              <Link href="/candidate/companies">browse companies</Link>.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
