'use client';

import Link from 'next/link';
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
  }).format(date);
}

function isPastDeadline(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export default function AdminJobsPage() {
  const api = useAdminApi();
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 });
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
    <>
      <div className="flex flex-col gap-1 mb-6">
        <h1>Jobs Catalog</h1>
        <p>Discovered and deduplicated job openings from career crawls.</p>
      </div>

      <form className="admin-filters" onSubmit={handleFilter}>
        <label>
          Search jobs
          <input
            name="search"
            defaultValue={filters.search}
            placeholder="Job title, company, or location"
            maxLength={200}
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status}>
            <option value="">All statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </label>
        <button type="submit" className="w-auto px-6">
          Filter
        </button>
      </form>

      {error && (
        <p className="error mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <section className="card">
          <p className="muted">Loading jobs catalog…</p>
        </section>
      ) : result && result.rows.length === 0 ? (
        <section className="card">
          <p className="muted">
            No jobs match your search criteria. Run the crawler to discover new roles.
          </p>
        </section>
      ) : result ? (
        <>
          <div className="admin-table-wrap card p-0 overflow-hidden mb-6">
            <table>
              <thead>
                <tr>
                  <th>Job Title & Company</th>
                  <th>Location</th>
                  <th>Work Mode</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>First Seen</th>
                  <th>Application</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((job) => {
                  const expired = isPastDeadline(job.applicationDeadline);
                  return (
                    <tr key={job.id}>
                      <td>
                        <div className="font-semibold text-slate-900">{job.title}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {job.companyWebsiteUrl ? (
                            <a
                              href={job.companyWebsiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-slate-800 hover:text-black"
                            >
                              {job.companyName} ↗
                            </a>
                          ) : (
                            <Link
                              href={`/admin/companies/${encodeURIComponent(job.companyId)}`}
                              className="underline text-slate-800"
                            >
                              {job.companyName}
                            </Link>
                          )}
                        </div>
                        {job.companyCategories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {job.companyCategories.map((cat) => (
                              <span
                                key={cat}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-700">
                        {job.location || '—'}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-700">
                        {job.workMode || '—'}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-700">
                        <div>{formatDate(job.applicationDeadline)}</div>
                        {expired && (
                          <span className="inline-block mt-0.5 rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-semibold text-rose-800">
                            Expired
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            job.status === 'OPEN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-600">
                        {formatDate(job.firstSeenAt)}
                      </td>
                      <td className="whitespace-nowrap">
                        {job.applicationUrl ? (
                          <a
                            href={job.applicationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold"
                          >
                            Apply ↗
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination items-center mb-8">
            <button
              type="button"
              className="secondary"
              disabled={filters.page <= 1}
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            >
              Previous
            </button>
            <span className="text-xs text-slate-600">
              Page {result.page} of {totalPages} · {result.total} total jobs
            </span>
            <button
              type="button"
              className="secondary"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
