'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAdminApi } from '../../../lib/admin-api';

interface CrawlLogRow {
  id: string;
  companyId: string;
  companyName: string;
  checkedAt: string;
  success: boolean;
  jobsFound: number;
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

export default function AdminCrawlLogsPage() {
  const api = useAdminApi();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CrawlLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    api<CrawlLogPage>(`/admin/crawl-logs?page=${page}&pageSize=50`, {
      signal: controller.signal,
    })
      .then((res) => setData(res))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load crawler logs.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [api, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="flex flex-col gap-1 mb-4">
        <h1>Crawler Logs</h1>
        <p>Operational audit trail and error diagnostics for career-page crawls.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 mb-6">
        <strong>Monitoring only:</strong> Career-page checks execute via scheduled background
        workers or the command line runner (<code>pnpm crawl:daily</code>).
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
          <p className="muted">No crawl logs recorded yet.</p>
        </section>
      ) : data ? (
        <>
          <div className="admin-table-wrap card p-0 overflow-hidden mb-6">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Checked At</th>
                  <th>Status</th>
                  <th>Jobs Found</th>
                  <th>Diagnostic / Error</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <Link
                        href={`/admin/companies/${encodeURIComponent(log.companyId)}`}
                        className="font-semibold text-slate-900"
                      >
                        {log.companyName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-600">
                      {formatDate(log.checkedAt)}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          log.success
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="text-xs font-medium text-slate-800">{log.jobsFound}</td>
                    <td className="text-xs text-slate-600 font-mono break-all">
                      {log.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination items-center mb-8">
            <button
              type="button"
              className="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="text-xs text-slate-600">
              Page {data.page} of {totalPages} · {data.total} total runs
            </span>
            <button
              type="button"
              className="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
