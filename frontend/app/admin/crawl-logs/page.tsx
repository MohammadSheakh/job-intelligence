'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { safeExternalUrl } from '../../../lib/external-url';
import { useAdminApi } from '../../../lib/admin-api';

interface CrawlLogRow {
  id: string;
  companyId: string;
  companyName: string;
  careerUrl: string | null;
  websiteUrl: string | null;
  recommendedAction: string | null;
  checkedAt: string;
  success: boolean;
  jobsFound: number;
  httpStatus: number | null;
  durationMs: number | null;
  crawlerType: string | null;
  jobsCreated: number | null;
  jobsUpdated: number | null;
  actionTaken: string | null;
  error: string | null;
}

interface CrawlLogPage {
  total: number;
  page: number;
  pageSize: number;
  rows: CrawlLogRow[];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getActionDescription(
  action: string | null,
  error: string | null,
  status: number | null,
): { label: string; tip: string; tone: 'neutral' | 'warning' | 'alert' } {
  if (
    action === 'CUSTOM_ADAPTER_REQUIRED' ||
    status === 403 ||
    /403|challenge|captcha|cloudflare|waf/i.test(error ?? '')
  ) {
    return {
      label: 'CUSTOM_ADAPTER_REQUIRED',
      tip: 'Access challenge or bot protection detected. Review an allowed source or dedicated adapter; do not bypass access protections.',
      tone: 'alert',
    };
  }
  if (action === 'FIND_CAREER_PAGE' || status === 404 || /404|not found/i.test(error ?? '')) {
    return {
      label: 'FIND_CAREER_PAGE',
      tip: 'Career page URL returned 404 Not Found. Inspect official website to update the career URL.',
      tone: 'warning',
    };
  }
  if (/timeout/i.test(error ?? '')) {
    return {
      label: 'RETRY_LATER',
      tip: 'Network connection exceeded the 20-second timeout budget. Review connectivity and retry through the normal crawl workflow.',
      tone: 'warning',
    };
  }
  if (action === 'MONITOR_READY') {
    return {
      label: 'MONITOR_READY',
      tip: 'Career page crawled and parsed cleanly. Monitoring eligibility depends on the current company settings.',
      tone: 'neutral',
    };
  }
  return {
    label: action ?? 'REVIEW_REQUIRED',
    tip: 'Review error diagnostics and verify company career portal settings.',
    tone: 'warning',
  };
}

export default function AdminCrawlLogsPage() {
  const api = useAdminApi();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [successFilter, setSuccessFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [data, setData] = useState<CrawlLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const queryParts = [`page=${page}`, `pageSize=50`];
    if (search.trim()) queryParts.push(`search=${encodeURIComponent(search.trim())}`);
    if (successFilter === 'success') queryParts.push('success=true');
    if (successFilter === 'failure') queryParts.push('success=false');

    api<CrawlLogPage>(`/admin/crawl-logs?${queryParts.join('&')}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted) {
          setData(res);
          setExpandedIds(new Set());
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(err instanceof Error ? err.message : 'Failed to load crawler logs.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [api, page, search, successFilter]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section>
      <div className="flex flex-col gap-1 mb-4">
        <p className="eyebrow">Operational Diagnostics</p>
        <h1>Crawler Logs</h1>
        <p>
          Recorded crawl attempts, HTTP response metrics, and failure diagnostics for career-page
          crawls.
        </p>
      </div>

      <div className="admin-filters">
        <label className="compact-label sm:col-span-2">
          Search by company
          <input
            type="search"
            maxLength={120}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search company name…"
          />
        </label>

        <label className="compact-label">
          Outcome
          <select
            value={successFilter}
            onChange={(e) => {
              setSuccessFilter(e.target.value as 'all' | 'success' | 'failure');
              setPage(1);
            }}
          >
            <option value="all">All crawl outcomes</option>
            <option value="success">Success only</option>
            <option value="failure">Failures only</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="error mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <section className="card">
          <p className="muted">Loading crawl logs…</p>
        </section>
      ) : data && data.rows.length === 0 ? (
        <section className="card">
          <p className="muted">No crawl logs recorded matching the criteria.</p>
        </section>
      ) : data ? (
        <>
          <div className="admin-table-wrap card p-0 overflow-x-auto mb-6">
            <table>
              <thead>
                <tr>
                  <th>Company &amp; Source</th>
                  <th>Checked</th>
                  <th>Result</th>
                  <th>Fetch time</th>
                  <th>Jobs</th>
                  <th>Suggested Follow-up</th>
                  <th>Diagnostic</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((log) => {
                  const isExpanded = expandedIds.has(log.id);
                  const actionInfo = getActionDescription(
                    log.actionTaken,
                    log.error,
                    log.httpStatus,
                  );

                  return (
                    <tr key={log.id} className="border-b border-neutral-100">
                      <td className="max-w-[220px]">
                        <Link
                          href={`/admin/companies/${encodeURIComponent(log.companyId)}`}
                          className="font-bold text-neutral-950 hover:underline"
                        >
                          {log.companyName}
                        </Link>
                        {safeExternalUrl(log.careerUrl) ? (
                          <p className="text-xs mt-0.5">
                            <a
                              href={safeExternalUrl(log.careerUrl)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neutral-500 hover:text-neutral-900"
                            >
                              Current career page ↗
                            </a>
                          </p>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap text-xs text-neutral-600">
                        {formatDate(log.checkedAt)}
                      </td>

                      <td>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              log.success
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.success ? 'SUCCESS' : 'FAILED'}
                          </span>
                          {log.httpStatus && (
                            <span className="font-mono text-xs text-neutral-500">
                              {log.httpStatus}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap text-xs font-mono text-neutral-700">
                        {formatDuration(log.durationMs)}
                      </td>

                      <td>
                        {log.success ? (
                          <div className="text-xs">
                            <strong>{log.jobsFound} found</strong>
                            <p className="text-[11px] text-neutral-500 m-0">
                              {log.jobsCreated ?? '—'} new · {log.jobsUpdated ?? '—'} existing
                              refreshed
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">0 found</span>
                        )}
                      </td>

                      <td>
                        <span
                          className={`inline-block font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
                            actionInfo.tone === 'alert'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : actionInfo.tone === 'warning'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-neutral-100 text-neutral-800'
                          }`}
                        >
                          {actionInfo.label}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={isExpanded ? `crawl-detail-${log.id}` : undefined}
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${log.companyName}`}
                          onClick={() => toggleExpand(log.id)}
                          className="inline-flex items-center justify-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-200"
                        >
                          {isExpanded ? 'Hide ▲' : 'Details ▼'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Render detail drawers for expanded rows */}
          {data.rows
            .filter((log) => expandedIds.has(log.id))
            .map((log) => {
              const actionInfo = getActionDescription(log.actionTaken, log.error, log.httpStatus);

              return (
                <div
                  id={`crawl-detail-${log.id}`}
                  key={`expanded-${log.id}`}
                  className="card mb-4 border-l-4 border-l-neutral-900 bg-neutral-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                    <div>
                      <h2 className="text-base font-bold text-neutral-950">
                        Crawl Diagnostic · {log.companyName}
                      </h2>
                      <p className="text-xs text-neutral-500 m-0">
                        Run ID #{log.id} · Checked at {formatDate(log.checkedAt)}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-2 sm:mt-0">
                      {safeExternalUrl(log.careerUrl) && (
                        <a
                          href={safeExternalUrl(log.careerUrl)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-neutral-800 hover:underline"
                        >
                          Visit Current career page ↗
                        </a>
                      )}
                      {safeExternalUrl(log.websiteUrl) && (
                        <a
                          href={safeExternalUrl(log.websiteUrl)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-neutral-800 hover:underline"
                        >
                          Visit Website ↗
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4 bg-white p-3 rounded-lg border border-neutral-200 text-xs mb-3">
                    <div>
                      <span className="text-neutral-500">Crawler Engine:</span>
                      <p className="font-semibold text-neutral-900 m-0">
                        {log.crawlerType ?? 'Not recorded'}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500">HTTP Status:</span>
                      <p className="font-semibold font-mono text-neutral-900 m-0">
                        {log.httpStatus ?? '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Duration:</span>
                      <p className="font-semibold font-mono text-neutral-900 m-0">
                        {formatDuration(log.durationMs)}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Jobs Detected:</span>
                      <p className="font-semibold text-neutral-900 m-0">
                        {log.jobsFound} total ({log.jobsCreated ?? '—'} created,{' '}
                        {log.jobsUpdated ?? '—'} existing refreshed)
                      </p>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-lg text-xs mb-3 ${
                      actionInfo.tone === 'alert'
                        ? 'bg-red-50 text-red-900 border border-red-200'
                        : actionInfo.tone === 'warning'
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    }`}
                  >
                    <strong>Suggested follow-up ({actionInfo.label}):</strong> {actionInfo.tip}
                  </div>

                  {log.error ? (
                    <div>
                      <span className="text-xs font-semibold text-red-700">Diagnostic:</span>
                      <pre className="mt-1 p-2 bg-neutral-900 text-neutral-100 rounded text-[11px] font-mono whitespace-pre-wrap break-all">
                        {log.error}
                      </pre>
                    </div>
                  ) : null}
                </div>
              );
            })}

          <div className="admin-pagination items-center mb-8">
            <button
              type="button"
              className="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="text-xs text-neutral-600">
              Page {data.page} of {totalPages} · {data.total} total runs
            </span>
            <button
              type="button"
              className="secondary"
              disabled={page >= totalPages || page >= 10000}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
