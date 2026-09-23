'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../lib/admin-api';

interface JobRow {
  id: string;
  companyId: string;
  companyName: string;
  companyWebsiteUrl: string | null;
  companyCategories: string[];
  title: string;
  location: string | null;
  workMode: string | null;
  skills: string | null;
  experience: string | null;
  applicationUrl: string | null;
  applicationDeadline: string | null;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface JobPage {
  total: number;
  page: number;
  pageSize: number;
  rows: JobRow[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
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

function isPastDeadline(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export default function AdminJobsPage() {
  const api = useAdminApi();
  const [filters, setFilters] = useState({ search: '', status: 'OPEN', page: 1 });
  const [result, setResult] = useState<JobPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const query = new URLSearchParams({
      page: String(filters.page),
      pageSize: '25',
    });
    if (filters.search) query.set('search', filters.search);
    if (filters.status) query.set('status', filters.status);

    api<JobPage>(`/admin/jobs?${query.toString()}`, { signal: controller.signal })
      .then((data) => setResult(data))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [api, filters]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFilters({
      search: String(form.get('search') ?? '').trim(),
      status: String(form.get('status') ?? ''),
      page: 1,
    });
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="max-w-6xl">
      {/* Header matching Figma image 7 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Jobs</h1>
        <p className="text-sm text-neutral-500 mt-1">Discovered and deduplicated openings</p>
      </div>

      {/* Filter Row matching Figma image 7 */}
      <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-3 mb-8">
        <div className="w-full sm:w-72">
          <label className="text-xs font-semibold text-neutral-500 mb-1">Search</label>
          <input
            name="search"
            defaultValue={filters.search}
            placeholder="Job, company, location"
            className="input-clean"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="text-xs font-semibold text-neutral-500 mb-1">Status</label>
          <select name="status" defaultValue={filters.status} className="select-clean">
            <option value="">All statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
        <button className="btn-pill-primary" disabled={loading}>
          Filter
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 mb-6" role="alert">
          <p className="text-sm font-medium text-rose-700">{error}</p>
        </div>
      )}

      {loading && <p className="py-8 text-sm text-neutral-400">Loading jobs…</p>}

      {!loading && !error && result && (
        <>
          {result.rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400 border border-neutral-100 rounded-2xl">
              No jobs found matching the current filters.
            </div>
          ) : (
            <div className="w-full overflow-x-auto mb-6">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Location</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>First Seen</th>
                    <th>Deadline</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((job) => {
                    const expired = isPastDeadline(job.applicationDeadline);
                    return (
                      <tr key={job.id} className="hover:bg-neutral-50/50 transition">
                        <td>
                          <div>
                            {job.applicationUrl ? (
                              <a
                                href={job.applicationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-neutral-900 hover:underline"
                              >
                                {job.title}
                              </a>
                            ) : (
                              <span className="font-bold text-neutral-900">{job.title}</span>
                            )}
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {job.companyWebsiteUrl ? (
                                <a
                                  href={job.companyWebsiteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline text-neutral-600"
                                >
                                  {job.companyName}
                                </a>
                              ) : (
                                <span>{job.companyName}</span>
                              )}
                            </div>
                            {job.companyCategories.length > 0 && (
                              <div className="flex flex-wrap mt-1">
                                {job.companyCategories.map((c) => (
                                  <span key={c} className="tag-pill text-[10px]">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-xs text-neutral-600 whitespace-nowrap">
                          {job.location || '—'}
                        </td>
                        <td className="text-xs text-neutral-600 whitespace-nowrap">
                          {job.workMode || '—'}
                        </td>
                        <td className="whitespace-nowrap">
                          <span
                            className={
                              job.status === 'OPEN' ? 'badge-success' : 'badge-neutral'
                            }
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="text-xs text-neutral-500 whitespace-nowrap">
                          {formatDate(job.firstSeenAt)}
                        </td>
                        <td className="text-xs whitespace-nowrap">
                          {job.applicationDeadline ? (
                            <span className={expired ? 'text-rose-600 font-medium' : 'text-neutral-600'}>
                              {formatDate(job.applicationDeadline)}
                              {expired && <span className="ml-1 text-[10px] text-rose-500">(expired)</span>}
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {job.applicationUrl ? (
                            <a
                              href={job.applicationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-neutral-900 hover:underline inline-flex items-center gap-1"
                            >
                              Apply <span>↗</span>
                            </a>
                          ) : (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination matching Figma */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">
              Page {result.page} of {totalPages} · {result.total}{' '}
              {result.total === 1 ? 'opening' : 'openings'}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn-pill-secondary text-xs"
                disabled={filters.page === 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Previous
              </button>
              <button
                className="btn-pill-secondary text-xs"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
