'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../lib/admin-api';
import { companyActions, type Category, type CompanyPage } from '../../../lib/company-intelligence';

export default function AdminCompaniesPage() {
  const api = useAdminApi();
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    action: '',
    needsManualReview: '',
    page: 1,
  });
  const [result, setResult] = useState<CompanyPage | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ ...filters, page: String(filters.page), pageSize: '25' });
    for (const key of ['search', 'category', 'action', 'needsManualReview']) {
      if (!query.get(key)) query.delete(key);
    }
    Promise.all([
      api<CompanyPage>(`/admin/companies?${query}`, { signal: controller.signal }),
      api<Category[]>('/admin/categories', { signal: controller.signal }),
    ])
      .then(([page, catalog]) => {
        setResult(page);
        setCategories(catalog);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Companies could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, filters, retry]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFilters({
      search: String(form.get('search') ?? '').trim(),
      category: String(form.get('category') ?? ''),
      action: String(form.get('action') ?? ''),
      needsManualReview: String(form.get('needsManualReview') ?? ''),
      page: 1,
    });
  }

  return (
    <div className="max-w-6xl">
      {/* Top Header matching Figma image 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Companies</h1>
          <p className="text-sm text-neutral-500 mt-1">Research data, categories and crawler targets</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                needsManualReview: f.needsManualReview === 'true' ? '' : 'true',
                page: 1,
              }))
            }
            className={
              filters.needsManualReview === 'true' ? 'btn-pill-primary' : 'btn-pill-secondary'
            }
          >
            {filters.needsManualReview === 'true' ? '✓ In Review Queue' : 'Manual Review Queue'}
          </button>
          <Link href="/admin/companies/new" className="btn-pill-primary">
            + Add Company
          </Link>
        </div>
      </div>

      {/* Filter Row matching Figma image 2 */}
      <form onSubmit={search} className="flex flex-wrap items-end gap-3 mb-8">
        <div className="w-full sm:w-64">
          <label htmlFor="search-companies-input" className="text-xs font-semibold text-neutral-500 mb-1">
            Search companies
          </label>
          <input
            id="search-companies-input"
            name="search"
            defaultValue={filters.search}
            className="input-clean"
            placeholder="Company, domain, location"
            maxLength={200}
          />
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor="category-select" className="text-xs font-semibold text-neutral-500 mb-1">
            Category
          </label>
          <select
            id="category-select"
            name="category"
            defaultValue={filters.category}
            aria-label="Category"
            className="select-clean"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor="action-select" className="text-xs font-semibold text-neutral-500 mb-1">
            Action
          </label>
          <select
            id="action-select"
            name="action"
            defaultValue={filters.action}
            aria-label="Research action"
            className="select-clean"
          >
            <option value="">All</option>
            {companyActions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-pill-primary" disabled={loading}>
          Search
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 mb-6" role="alert">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <button
            onClick={() => setRetry((value) => value + 1)}
            className="btn-pill-secondary mt-2 text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {loading && <p className="py-8 text-sm text-neutral-400">Loading companies…</p>}

      {!loading && !error && result && (
        <>
          {result.rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400 border border-neutral-100 rounded-2xl">
              No companies match these filters.
            </div>
          ) : (
            <div className="w-full overflow-x-auto mb-6">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Categories</th>
                    <th>Career</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Last Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((company) => (
                    <tr key={company.id} className="hover:bg-neutral-50/50 transition">
                      <td>
                        <Link
                          href={`/admin/companies/${encodeURIComponent(company.id)}`}
                          className="font-semibold text-neutral-900 hover:underline block"
                        >
                          {company.name}
                        </Link>
                        {company.websiteUrl && (
                          <a
                            href={company.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-neutral-400 hover:text-black block truncate max-w-xs"
                          >
                            {company.websiteUrl}
                          </a>
                        )}
                      </td>
                      <td className="text-sm text-neutral-600 whitespace-nowrap">
                        {company.location || '—'}
                      </td>
                      <td>
                        <div className="flex flex-wrap max-w-xs">
                          {company.categories.length > 0 ? (
                            company.categories.map((c) => (
                              <span key={c} className="tag-pill">
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {company.careerUrl ? (
                          <a
                            href={company.careerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-neutral-900 hover:underline inline-flex items-center gap-1"
                          >
                            Career page <span>↗</span>
                          </a>
                        ) : company.websiteUrl ? (
                          <a
                            href={company.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-neutral-500 hover:text-black hover:underline inline-flex items-center gap-1"
                          >
                            Website <span>↗</span>
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="text-xs font-semibold tracking-wider text-neutral-700 whitespace-nowrap">
                        {company.recommendedAction ?? '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={company.active ? 'badge-success' : 'badge-neutral'}>
                          {company.active ? 'Active' : 'Inactive'}
                        </span>
                        {company.needsManualReview && (
                          <span className="badge-review ml-1.5">Review</span>
                        )}
                      </td>
                      <td className="text-xs text-neutral-400 whitespace-nowrap">
                        {company.lastCheckedAt
                          ? new Date(company.lastCheckedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Clean Pagination matching Figma */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">
              {result.total} {result.total === 1 ? 'company' : 'companies'} · Page {result.page} of{' '}
              {Math.max(1, Math.ceil(result.total / result.pageSize))}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn-pill-secondary text-xs"
                disabled={filters.page === 1}
                onClick={() => setFilters((value) => ({ ...value, page: value.page - 1 }))}
              >
                Previous
              </button>
              <button
                className="btn-pill-secondary text-xs"
                disabled={result.page * result.pageSize >= result.total}
                onClick={() => setFilters((value) => ({ ...value, page: value.page + 1 }))}
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
