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
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 mb-1">Crawler</h1>
        <p className="text-sm text-neutral-500">Recent career-page checks</p>
      </div>

      <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-4 py-3 text-xs text-neutral-600 font-mono">
        This page is monitoring only. Run the crawler through the scheduled worker or npm run crawl:daily.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          maxLength={120}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search company name…"
          className="input-clean flex-1 min-w-[220px]"
        />

        <select
          value={successFilter}
          onChange={(e) => {
            setSuccessFilter(e.target.value as 'all' | 'success' | 'failure');
            setPage(1);
          }}
          className="select-clean min-w-[160px]"
        >
          <option value="all">All crawl outcomes</option>
          <option value="success">Success only</option>
          <option value="failure">Failures only</option>
        </select>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-neutral-400">Loading crawl logs…</div>
      ) : data && data.rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400">No crawl logs recorded matching the criteria.</div>
      ) : data ? (
        <>
          <div className="overflow-x-auto">
            <table className="table-clean w-full">
              <thead>
                <tr>
                  <th>COMPANY</th>
                  <th>CHECKED</th>
                  <th>STATUS</th>
                  <th>JOBS FOUND</th>
                  <th>ERROR / ACTION</th>
                  <th className="text-right">DETAILS</th>
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
                    <tr key={log.id} className="group">
                      <td className="max-w-[220px]">
                        <Link
                          href={`/admin/companies/${encodeURIComponent(log.companyId)}`}
                          className="font-semibold text-neutral-900 hover:underline block"
                        >
                          {log.companyName}
                        </Link>
                        {safeExternalUrl(log.careerUrl) ? (
                          <a
                            href={safeExternalUrl(log.careerUrl)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-neutral-400 hover:text-neutral-700 transition"
                          >
                            Career page ↗
                          </a>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap text-xs text-neutral-500">
                        {formatDate(log.checkedAt)}
                      </td>

                      <td>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              log.success
                                ? 'badge-success'
                                : 'badge-danger'
                            }
                          >
                            {log.success ? 'Success' : 'Failed'}
                          </span>
                          {log.httpStatus && (
                            <span className="font-mono text-xs text-neutral-400">
                              {log.httpStatus}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="text-xs text-neutral-800">
                        {log.success ? (
                          <div>
                            <span className="font-semibold">{log.jobsFound}</span>
                            <span className="text-[11px] text-neutral-400 ml-1.5">
                              ({log.jobsCreated ?? 0} new)
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">0</span>
                        )}
                      </td>

                      <td className="text-xs text-neutral-600 max-w-[260px]">
                        {log.error ? (
                          <span className="text-rose-600 font-mono text-[11px] truncate block">{log.error}</span>
                        ) : (
                          <span className="text-neutral-400 text-xs font-mono">{actionInfo.label}</span>
                        )}
                      </td>

                      <td className="text-right">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={isExpanded ? `crawl-detail-${log.id}` : undefined}
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${log.companyName}`}
                          onClick={() => toggleExpand(log.id)}
                          className="btn-pill-secondary text-xs px-3 py-1"
                        >
                          {isExpanded ? 'Hide' : 'Details'}
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
                  className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-neutral-900">
                        Crawl Diagnostic · {log.companyName}
                      </h2>
                      <p className="text-xs text-neutral-400">
                        Run ID #{log.id} · Checked at {formatDate(log.checkedAt)}
                      </p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      {safeExternalUrl(log.careerUrl) && (
                        <a
                          href={safeExternalUrl(log.careerUrl)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-neutral-700 hover:text-black hover:underline"
                        >
                          Career page ↗
                        </a>
                      )}
                      {safeExternalUrl(log.websiteUrl) && (
                        <a
                          href={safeExternalUrl(log.websiteUrl)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-neutral-700 hover:text-black hover:underline"
                        >
                          Website ↗
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-neutral-100 text-xs">
                    <div>
                      <span className="text-neutral-400 block text-[11px] mb-0.5">Engine</span>
                      <span className="font-medium text-neutral-900">{log.crawlerType ?? 'Standard'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px] mb-0.5">HTTP Status</span>
                      <span className="font-mono font-medium text-neutral-900">{log.httpStatus ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px] mb-0.5">Duration</span>
                      <span className="font-mono font-medium text-neutral-900">{formatDuration(log.durationMs)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px] mb-0.5">Jobs Result</span>
                      <span className="font-medium text-neutral-900">
                        {log.jobsFound} found ({log.jobsCreated ?? 0} new, {log.jobsUpdated ?? 0} updated)
                      </span>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-xl text-xs ${
                      actionInfo.tone === 'alert'
                        ? 'bg-rose-50 text-rose-800 border border-rose-100'
                        : actionInfo.tone === 'warning'
                          ? 'bg-amber-50 text-amber-800 border border-amber-100'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                    }`}
                  >
                    <span className="font-bold">{actionInfo.label}:</span> {actionInfo.tip}
                  </div>

                  {log.error && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                        Raw Diagnostics
                      </span>
                      <pre className="p-3 bg-neutral-900 text-neutral-200 rounded-xl text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto">
                        {log.error}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}

          <div className="flex items-center justify-between pt-4 border-t border-neutral-100 text-xs text-neutral-500">
            <span>
              Page {data.page} of {totalPages} · {data.total} records
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-pill-secondary text-xs px-4 py-1.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-pill-secondary text-xs px-4 py-1.5"
                disabled={page >= totalPages || page >= 10000}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
