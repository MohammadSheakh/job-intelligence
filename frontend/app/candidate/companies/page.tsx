'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeExternalUrl } from '../../../lib/external-url';
import { api, candidateAuthRedirect } from '../../../lib/api';
import { CandidateNav } from '../components/candidate-nav';

type Company = {
  id: string;
  name: string;
  websiteUrl: string | null;
  careerUrl: string | null;
  location: string | null;
  categories: string[];
  trackingStatus: string | null;
};

export default function CandidateCompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState('ALL');
  const [filters, setFilters] = useState({ q: '', location: '', category: '', status: 'ALL' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const requestId = useRef(0);
  const mutationPending = useRef(false);
  const pageSize = 25;

  // Ignore superseded requests so filter/page changes cannot display stale results.
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const id = ++requestId.current;
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          ...filters,
          page: String(page),
          pageSize: String(pageSize),
        });
        const result = await api<{ rows: Company[]; total: number }>(
          `/candidate/companies?${params}`,
          { signal },
        );
        if (signal?.aborted || id !== requestId.current) return;
        const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setCompanies(result.rows);
        setTotal(result.total);
      } catch (reason) {
        if (signal?.aborted || id !== requestId.current) return;
        const destination = candidateAuthRedirect(reason);
        if (destination) router.replace(destination);
        setCompanies([]);
        setError(reason instanceof Error ? reason.message : 'Companies could not be loaded.');
      } finally {
        if (!signal?.aborted && id === requestId.current) setLoading(false);
      }
    },
    [filters, page, router],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
      requestId.current += 1;
    };
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    api<Array<{ name: string }>>('/candidate/categories', { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) setCategories(rows.map((row) => row.name));
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        const destination = candidateAuthRedirect(reason);
        if (destination) router.replace(destination);
      });
    return () => controller.abort();
  }, [router]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationPending.current) return;
    setPage(1);
    setFilters({ q: query.trim(), location: '', category: category.trim(), status });
  }
  async function setPipelineState(company: Company, status: 'PLANNING' | 'APPLIED' | 'EXCLUDED') {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setSavingId(company.id);
    setError('');
    try {
      await api('/candidate/pipeline/company-state', {
        method: 'POST',
        body: JSON.stringify({ companyId: company.id, status }),
      });
      await load();
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      setError(reason instanceof Error ? reason.message : 'Company status could not be saved.');
    } finally {
      mutationPending.current = false;
      setSavingId(null);
    }
  }
  async function clearPipelineState(company: Company) {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setSavingId(company.id);
    setError('');
    try {
      await api(`/candidate/pipeline/${company.id}`, { method: 'DELETE' });
      await load();
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      setError(reason instanceof Error ? reason.message : 'Company status could not be removed.');
    } finally {
      mutationPending.current = false;
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CandidateNav />

      <main className="max-w-7xl w-full mx-auto px-6 py-10 space-y-8 flex-1">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 mb-1">Companies</h1>
          <p className="text-sm text-neutral-500">
            Browse active companies and keep your application state up to date.
          </p>
        </div>

        <form className="flex flex-wrap items-center gap-3" onSubmit={search}>
          <input
            aria-label="Search companies"
            maxLength={120}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Company or location"
            className="input-clean flex-1 min-w-[200px]"
          />
          <select
            aria-label="Category filter"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="select-clean min-w-[160px]"
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Tracking status filter"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="select-clean min-w-[160px]"
          >
            <option value="ALL">All tracking states</option>
            <option value="UNTRACKED">Not tracked</option>
            <option value="PLANNING">Planning</option>
            <option value="APPLIED">Applied</option>
            <option value="EXCLUDED">Blacklist</option>
          </select>
          <button
            type="submit"
            disabled={savingId !== null}
            className="btn-pill-primary px-5 py-2 text-xs"
          >
            Filter
          </button>
        </form>

        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-neutral-400">Loading companies…</div>
        ) : (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="table-clean w-full">
                <thead>
                  <tr>
                    <th>COMPANY</th>
                    <th>MY STATUS</th>
                    <th>LINK</th>
                    <th className="text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const isPlanning = company.trackingStatus === 'PLANNING';
                    const isApplied = company.trackingStatus === 'APPLIED';
                    const isExcluded = company.trackingStatus === 'EXCLUDED';
                    const isSaving = savingId === company.id;

                    const linkHref = safeExternalUrl(company.careerUrl) || safeExternalUrl(company.websiteUrl);
                    const linkLabel = safeExternalUrl(company.careerUrl) ? 'Career page' : safeExternalUrl(company.websiteUrl) ? 'Website' : null;

                    return (
                      <tr key={company.id}>
                        <td className="max-w-[280px]">
                          <span className="font-bold text-neutral-900 block text-sm">{company.name}</span>
                          {company.location && (
                            <span className="text-xs text-neutral-400 block mt-0.5">{company.location}</span>
                          )}
                          {company.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {company.categories.map((c) => (
                                <span key={c} className="tag-pill text-[10px]">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td>
                          {isPlanning ? (
                            <span className="badge-warning text-xs">Planning</span>
                          ) : isApplied ? (
                            <span className="badge-success text-xs">Applied</span>
                          ) : isExcluded ? (
                            <span className="badge-danger text-xs">Blacklist</span>
                          ) : (
                            <span className="text-neutral-400 text-xs">—</span>
                          )}
                        </td>

                        <td className="text-xs">
                          {linkHref && linkLabel ? (
                            <a
                              href={linkHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neutral-600 hover:text-black font-medium transition"
                            >
                              {linkLabel}
                            </a>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>

                        <td className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <label htmlFor={`pipeline-status-${company.id}`} className="text-xs sr-only">
                              Pipeline status
                            </label>
                            <select
                              id={`pipeline-status-${company.id}`}
                              aria-label="Pipeline status"
                              value={company.trackingStatus ?? ''}
                              disabled={isSaving}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val)
                                  void setPipelineState(
                                    company,
                                    val as 'PLANNING' | 'APPLIED' | 'EXCLUDED',
                                  );
                                else void clearPipelineState(company);
                              }}
                              className="select-clean text-xs py-1 px-2.5 rounded-full"
                            >
                              <option value="">Status…</option>
                              <option value="PLANNING">Planning</option>
                              <option value="APPLIED">Applied</option>
                              <option value="EXCLUDED">Blacklist</option>
                            </select>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                if (isPlanning) void clearPipelineState(company);
                                else void setPipelineState(company, 'PLANNING');
                              }}
                              className={`btn-pill-secondary text-xs px-3 py-1 ${isPlanning ? 'bg-amber-100 border-amber-300 font-bold text-amber-900' : ''}`}
                            >
                              {isPlanning ? 'Planning' : 'Plan'}
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                if (isApplied) void clearPipelineState(company);
                                else void setPipelineState(company, 'APPLIED');
                              }}
                              className={`text-xs px-3 py-1 rounded-full transition font-medium ${isApplied ? 'bg-neutral-950 text-white' : 'btn-pill-primary'}`}
                            >
                              Applied
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                if (isExcluded) void clearPipelineState(company);
                                else void setPipelineState(company, 'EXCLUDED');
                              }}
                              className={`btn-pill-danger text-xs px-3 py-1 ${isExcluded ? 'bg-rose-100 border-rose-300 font-bold' : ''}`}
                            >
                              Blacklist
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {companies.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-sm text-neutral-400">
                        No companies match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-neutral-100 text-xs text-neutral-500">
              <span aria-live="polite">
                Page {page} of {Math.max(1, Math.ceil(total / pageSize))} · {total} companies
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-pill-secondary text-xs px-4 py-1.5"
                  disabled={page <= 1 || savingId !== null}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-pill-secondary text-xs px-4 py-1.5"
                  disabled={page * pageSize >= total || page >= 10000 || savingId !== null}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
