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

interface Category {
  id: string;
  name: string;
  type: 'technology' | 'domain' | 'sector' | 'other';
  companyCount: number;
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
  const [filters, setFilters] = useState({
    search: '',
    technology: '',
    domain: '',
    sector: '',
    status: 'OPEN',
    page: 1,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<JobPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch available categories once on mount
  useEffect(() => {
    const controller = new AbortController();
    api<Category[]>('/admin/categories', { signal: controller.signal })
      .then((data) => setCategories(data))
      .catch(() => {});
    return () => controller.abort();
  }, [api]);

  // Fetch filtered jobs
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
    if (filters.technology) query.set('technology', filters.technology);
    if (filters.domain) query.set('domain', filters.domain);
    if (filters.sector) query.set('sector', filters.sector);

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
    setFilters((prev) => ({
      ...prev,
      search: String(form.get('search') ?? '').trim(),
      technology: String(form.get('technology') ?? ''),
      domain: String(form.get('domain') ?? ''),
      sector: String(form.get('sector') ?? ''),
      status: String(form.get('status') ?? ''),
      page: 1,
    }));
  }

  function handleReset() {
    setFilters({
      search: '',
      technology: '',
      domain: '',
      sector: '',
      status: 'OPEN',
      page: 1,
    });
  }

  const technologies = categories
    .filter((c) => c.type.toLowerCase() === 'technology')
    .sort((a, b) => a.name.localeCompare(b.name));

  const domains = categories
    .filter((c) => c.type.toLowerCase() === 'domain')
    .sort((a, b) => a.name.localeCompare(b.name));

  const sectors = categories
    .filter((c) => c.type.toLowerCase() === 'sector')
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.technology ||
      filters.domain ||
      filters.sector ||
      (filters.status && filters.status !== 'OPEN'),
  );

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="max-w-6xl">
      {/* Header matching Figma image 7 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Jobs</h1>
        <p className="text-sm text-neutral-500 mt-1">Discovered and deduplicated openings</p>
      </div>

      {/* Filter Row matching Technology, Domain, Sector grouping */}
      <form onSubmit={handleFilter} className="space-y-4 mb-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-60">
            <label htmlFor="job-search" className="text-xs font-semibold text-neutral-500 mb-1">
              Search
            </label>
            <input
              id="job-search"
              name="search"
              defaultValue={filters.search}
              placeholder="Job, company, skills"
              className="input-clean"
            />
          </div>

          <div className="w-full sm:w-44">
            <label htmlFor="filter-tech" className="text-xs font-semibold text-neutral-500 mb-1">
              Technology
            </label>
            <select
              id="filter-tech"
              name="technology"
              value={filters.technology}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, technology: e.target.value, page: 1 }))
              }
              className="select-clean"
            >
              <option value="">All technologies</option>
              {technologies.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-44">
            <label htmlFor="filter-domain" className="text-xs font-semibold text-neutral-500 mb-1">
              Domain
            </label>
            <select
              id="filter-domain"
              name="domain"
              value={filters.domain}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, domain: e.target.value, page: 1 }))
              }
              className="select-clean"
            >
              <option value="">All domains</option>
              {domains.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-44">
            <label htmlFor="filter-sector" className="text-xs font-semibold text-neutral-500 mb-1">
              Sector
            </label>
            <select
              id="filter-sector"
              name="sector"
              value={filters.sector}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sector: e.target.value, page: 1 }))
              }
              className="select-clean"
            >
              <option value="">All sectors</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-36">
            <label htmlFor="filter-status" className="text-xs font-semibold text-neutral-500 mb-1">
              Status
            </label>
            <select
              id="filter-status"
              name="status"
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))
              }
              className="select-clean"
            >
              <option value="">All statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button type="submit" className="btn-pill-primary" disabled={loading}>
              Filter
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleReset}
                className="btn-pill-secondary text-xs"
                disabled={loading}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-neutral-400 font-medium">Active filters:</span>
            {filters.search && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium">
                Search: "{filters.search}"
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, search: '', page: 1 }))}
                  className="hover:text-black ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}
            {filters.technology && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                Tech: {filters.technology}
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, technology: '', page: 1 }))}
                  className="hover:text-blue-900 ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}
            {filters.domain && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                Domain: {filters.domain}
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, domain: '', page: 1 }))}
                  className="hover:text-emerald-900 ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}
            {filters.sector && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-200">
                Sector: {filters.sector}
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, sector: '', page: 1 }))}
                  className="hover:text-purple-900 ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}
            {filters.status && filters.status !== 'OPEN' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium">
                Status: {filters.status}
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, status: 'OPEN', page: 1 }))}
                  className="hover:text-black ml-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-neutral-400 hover:text-neutral-900 transition underline ml-1 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
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
              <table className="table-clean w-full">
                <thead>
                  <tr>
                    <th>Job & Company</th>
                    <th>Location</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>First Seen</th>
                    <th>Deadline</th>
                    <th className="text-right">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((job) => {
                    const expired = isPastDeadline(job.applicationDeadline);
                    return (
                      <tr key={job.id} className="hover:bg-neutral-50/50 transition">
                        <td className="max-w-[320px]">
                          <div>
                            {job.applicationUrl ? (
                              <a
                                href={job.applicationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-neutral-900 hover:underline block text-sm"
                              >
                                {job.title}
                              </a>
                            ) : (
                              <span className="font-bold text-neutral-900 block text-sm">
                                {job.title}
                              </span>
                            )}
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {job.companyWebsiteUrl ? (
                                <a
                                  href={job.companyWebsiteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline text-neutral-600 font-medium"
                                >
                                  {job.companyName}
                                </a>
                              ) : (
                                <span className="font-medium text-neutral-600">
                                  {job.companyName}
                                </span>
                              )}
                            </div>
                            {job.companyCategories.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {job.companyCategories.map((c) => {
                                  const cat = categories.find(
                                    (item) => item.name.toLowerCase() === c.toLowerCase(),
                                  );
                                  return (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => {
                                        if (cat?.type === 'technology') {
                                          setFilters((prev) => ({
                                            ...prev,
                                            technology: cat.name,
                                            page: 1,
                                          }));
                                        } else if (cat?.type === 'domain') {
                                          setFilters((prev) => ({
                                            ...prev,
                                            domain: cat.name,
                                            page: 1,
                                          }));
                                        } else if (cat?.type === 'sector') {
                                          setFilters((prev) => ({
                                            ...prev,
                                            sector: cat.name,
                                            page: 1,
                                          }));
                                        } else {
                                          setFilters((prev) => ({
                                            ...prev,
                                            search: c,
                                            page: 1,
                                          }));
                                        }
                                      }}
                                      className="tag-pill text-[10px] hover:border-black transition cursor-pointer"
                                      title={`Filter by ${c}`}
                                    >
                                      {c}
                                    </button>
                                  );
                                })}
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
                            <span
                              className={
                                expired ? 'text-rose-600 font-medium' : 'text-neutral-600'
                              }
                            >
                              {formatDate(job.applicationDeadline)}
                              {expired && (
                                <span className="ml-1 text-[10px] text-rose-500">(expired)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right">
                          {job.applicationUrl ? (
                            <a
                              href={job.applicationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-pill-secondary text-xs px-3 py-1 inline-flex items-center gap-1"
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
              {result.total} {result.total === 1 ? 'opening' : 'openings'} · Page {result.page} of{' '}
              {totalPages}
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
