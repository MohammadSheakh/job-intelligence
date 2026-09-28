'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../lib/admin-api';
import {
  companyActions,
  type Category,
  type Company,
  type CompanyPage,
} from '../../../lib/company-intelligence';

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

  // Delete company state
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // LinkedIn batch crawl state
  const [linkedInPendingCount, setLinkedInPendingCount] = useState<number | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchLimit, setBatchLimit] = useState(25);
  const [batchDelay] = useState(1200);
  const [batchSummary, setBatchSummary] = useState<{
    totalProcessed: number;
    websitesFound: number;
    careersFound: number;
    failed: number;
    results: Array<{
      companyId: string;
      companyName: string;
      websiteUrl: string | null;
      careerUrl: string | null;
      actionTaken: string;
      success: boolean;
      error?: string;
    }>;
  } | null>(null);

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
      api<{ pendingCount: number }>('/admin/companies/enrich-linkedin/status', {
        signal: controller.signal,
      }).catch(() => ({ pendingCount: 0 })),
    ])
      .then(([page, catalog, status]) => {
        setResult(page);
        setCategories(catalog);
        setLinkedInPendingCount(status.pendingCount);
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

  async function runBatchEnrichment() {
    setBatchRunning(true);
    setError('');
    try {
      const summary = await api<{
        totalProcessed: number;
        websitesFound: number;
        careersFound: number;
        failed: number;
        results: Array<{
          companyId: string;
          companyName: string;
          websiteUrl: string | null;
          careerUrl: string | null;
          actionTaken: string;
          success: boolean;
          error?: string;
        }>;
      }>('/admin/companies/enrich-linkedin', {
        method: 'POST',
        body: JSON.stringify({
          limit: batchLimit,
          delayMs: batchDelay,
        }),
      });
      setBatchSummary(summary);
      setRetry((r) => r + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Batch enrichment encountered an error.');
    } finally {
      setBatchRunning(false);
    }
  }

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

  async function confirmDeleteCompany() {
    if (!companyToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api(`/admin/companies/${encodeURIComponent(companyToDelete.id)}`, {
        method: 'DELETE',
      });
      const deletedName = companyToDelete.name;
      const deletedId = companyToDelete.id;

      // Close modal
      setCompanyToDelete(null);

      // Optimistically remove row from current page
      setResult((prev) =>
        prev
          ? {
              ...prev,
              total: Math.max(0, prev.total - 1),
              rows: prev.rows.filter((r) => r.id !== deletedId),
            }
          : prev,
      );

      setSuccessMessage(`Company "${deletedName}" was successfully deleted.`);

      // Trigger background sync
      setRetry((r) => r + 1);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete company. Please try again.',
      );
    } finally {
      setIsDeleting(false);
    }
  }

  // Auto-dismiss success notification after 4.5 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage('');
    }, 4500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Handle ESC key for modal dismissal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (companyToDelete && !isDeleting) {
          setCompanyToDelete(null);
          setDeleteError('');
        } else if (batchModalOpen && !batchRunning) {
          setBatchModalOpen(false);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [companyToDelete, isDeleting, batchModalOpen, batchRunning]);

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
            onClick={() => setBatchModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition shadow-sm"
          >
            <span>⚡ Enrich from LinkedIn</span>
            {linkedInPendingCount !== null && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-sky-600 text-white">
                {linkedInPendingCount}
              </span>
            )}
          </button>
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

      {successMessage && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 mb-6 flex items-center justify-between shadow-xs"
          role="status"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            className="text-xs text-emerald-700 hover:text-emerald-950 font-bold px-2 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

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
                    <th className="text-right pr-4">Actions</th>
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
                      <td className="text-right pr-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setCompanyToDelete(company);
                            setDeleteError('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200/80 hover:border-rose-600 transition shadow-xs cursor-pointer"
                          title={`Delete ${company.name}`}
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6" />
                          </svg>
                          <span>Delete</span>
                        </button>
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

      {/* Batch LinkedIn Enrichment Modal */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-100 max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <span>⚡ Batch LinkedIn Enrichment Crawler</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Scrapes LinkedIn profiles, extracts official websites, and auto-detects career URLs
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                disabled={batchRunning}
                className="text-neutral-400 hover:text-neutral-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-center">
                  <div className="text-xs text-neutral-500 font-medium">Pending Queue</div>
                  <div className="text-xl font-bold text-neutral-900 mt-1">
                    {linkedInPendingCount ?? '—'}
                  </div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-center">
                  <div className="text-xs text-neutral-500 font-medium">Batch Limit</div>
                  <div className="text-xl font-bold text-sky-600 mt-1">{batchLimit}</div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-center">
                  <div className="text-xs text-neutral-500 font-medium">Rate Delay</div>
                  <div className="text-xl font-bold text-neutral-900 mt-1">{batchDelay}ms</div>
                </div>
              </div>

              {!batchRunning && !batchSummary && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-2">
                      Select Batch Size:
                    </label>
                    <div className="flex gap-2">
                      {[5, 10, 25, 50, 100].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setBatchLimit(num)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            batchLimit === num
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                          }`}
                        >
                          {num} companies
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500 leading-relaxed bg-amber-50/60 text-amber-800 p-3 rounded-xl border border-amber-200">
                    ℹ️ Crawls LinkedIn with Googlebot crawler headers to avoid login walls, extracts the canonical company website, and tests common career endpoints (/careers, /jobs, /join-us).
                  </p>
                </div>
              )}

              {batchRunning && (
                <div className="py-8 text-center space-y-3">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-sky-600 border-t-transparent"></div>
                  <p className="text-sm font-semibold text-neutral-900">
                    Crawling LinkedIn profiles and discovering career pages...
                  </p>
                  <p className="text-xs text-neutral-500">
                    Applying rate limiting delays ({batchDelay}ms) to ensure compliance.
                  </p>
                </div>
              )}

              {batchSummary && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2.5 bg-neutral-50 rounded-xl text-center">
                      <div className="text-[11px] text-neutral-500">Processed</div>
                      <div className="text-base font-bold text-neutral-900 mt-0.5">
                        {batchSummary.totalProcessed}
                      </div>
                    </div>
                    <div className="p-2.5 bg-sky-50 rounded-xl text-center">
                      <div className="text-[11px] text-sky-700">Websites</div>
                      <div className="text-base font-bold text-sky-700 mt-0.5">
                        {batchSummary.websitesFound}
                      </div>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-xl text-center">
                      <div className="text-[11px] text-emerald-700">Careers</div>
                      <div className="text-base font-bold text-emerald-700 mt-0.5">
                        {batchSummary.careersFound}
                      </div>
                    </div>
                    <div className="p-2.5 bg-rose-50 rounded-xl text-center">
                      <div className="text-[11px] text-rose-700">Failed</div>
                      <div className="text-base font-bold text-rose-700 mt-0.5">
                        {batchSummary.failed}
                      </div>
                    </div>
                  </div>

                  <div className="border border-neutral-100 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-neutral-500 font-semibold sticky top-0">
                        <tr>
                          <th className="p-2">Company</th>
                          <th className="p-2">Website</th>
                          <th className="p-2">Career URL</th>
                          <th className="p-2">Action Taken</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {batchSummary.results.map((r) => (
                          <tr key={r.companyId} className="hover:bg-neutral-50/50">
                            <td className="p-2 font-medium text-neutral-900">{r.companyName}</td>
                            <td className="p-2 text-neutral-600 truncate max-w-[140px]">
                              {r.websiteUrl || '—'}
                            </td>
                            <td className="p-2 text-neutral-600 truncate max-w-[140px]">
                              {r.careerUrl || '—'}
                            </td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  r.actionTaken === 'DISCOVERED_CAREER_URL'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : r.actionTaken === 'DISCOVERED_WEBSITE_ONLY'
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-neutral-100 text-neutral-600'
                                }`}
                              >
                                {r.actionTaken}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setBatchModalOpen(false);
                  setBatchSummary(null);
                }}
                disabled={batchRunning}
                className="btn-pill-secondary text-xs"
              >
                {batchSummary ? 'Close & Refresh' : 'Cancel'}
              </button>
              {!batchSummary && (
                <button
                  type="button"
                  onClick={runBatchEnrichment}
                  disabled={batchRunning}
                  className="btn-pill-primary text-xs"
                >
                  {batchRunning ? 'Crawling...' : `Start Batch Crawl (${batchLimit})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {companyToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-company-title"
          onClick={() => {
            if (!isDeleting) {
              setCompanyToDelete(null);
              setDeleteError('');
            }
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-neutral-100 max-w-md w-full p-6 flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Danger Icon */}
            <div className="flex items-start justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6" />
                  </svg>
                </div>
                <div>
                  <h3 id="delete-company-title" className="text-base font-bold text-neutral-900">
                    Delete Company
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Confirm deletion of company profile
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setCompanyToDelete(null);
                    setDeleteError('');
                  }
                }}
                disabled={isDeleting}
                className="text-neutral-400 hover:text-neutral-700 text-sm font-semibold p-1 cursor-pointer disabled:opacity-50"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-3">
              <p className="text-sm text-neutral-700 leading-relaxed">
                Are you sure you want to delete{' '}
                <span className="font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded">
                  {companyToDelete.name}
                </span>
                ?
              </p>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed">
                ⚠️ <strong>Permanent Action:</strong> Associated crawl logs, discovered jobs, and candidate bookmarks for this company will also be removed. This action <strong>cannot be undone</strong>.
              </div>

              {deleteError && (
                <div
                  className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700"
                  role="alert"
                >
                  {deleteError}
                </div>
              )}
            </div>

            {/* Modal Footer Buttons */}
            <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCompanyToDelete(null);
                  setDeleteError('');
                }}
                disabled={isDeleting}
                className="btn-pill-secondary text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCompany}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:shadow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

