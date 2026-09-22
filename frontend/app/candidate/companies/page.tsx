'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeExternalUrl } from '../../../lib/external-url';
import { api, candidateAuthRedirect } from '../../../lib/api';

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
  const [location, setLocation] = useState('');
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
    setFilters({ q: query.trim(), location: location.trim(), category: category.trim(), status });
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
    <main>
      <header>
        <div>
          <p className="eyebrow">Candidate portal</p>
          <h1>Companies</h1>
          <p className="muted">
            Browse active companies and keep your application state up to date.
          </p>
        </div>
        <nav>
          <Link href="/candidate">Overview</Link>
          <Link href="/candidate/profile">Profile</Link>
          <Link href="/candidate/pipeline">Pipeline</Link>
        </nav>
      </header>
      <form className="admin-filters" onSubmit={search}>
        <input
          aria-label="Search companies"
          maxLength={120}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, location, or technology"
        />
        <input
          aria-label="Location filter"
          placeholder="Location"
          value={location}
          maxLength={120}
          onChange={(event) => setLocation(event.target.value)}
        />
        <select
          aria-label="Category filter"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
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
        >
          <option value="ALL">All tracking states</option>
          <option value="UNTRACKED">Not tracked</option>
          <option value="PLANNING">Planning</option>
          <option value="APPLIED">Applied</option>
          <option value="EXCLUDED">Excluded</option>
        </select>
        <button disabled={savingId !== null}>Search</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="muted">Loading companies…</p>
      ) : (
        <section className="results">
          {companies.map((company) => (
            <article className="card company" key={company.id}>
              <div>
                <h2>{company.name}</h2>
                <p>{company.location ?? 'Location not listed'}</p>
                <p className="tags">{company.categories.join(' · ') || 'Uncategorized'}</p>
              </div>
              <div className="company-actions">
                {company.trackingStatus && <span className="status">{company.trackingStatus}</span>}
                <label className="compact-label">
                  Pipeline status
                  <select
                    value={company.trackingStatus ?? ''}
                    disabled={savingId !== null}
                    onChange={(event) => {
                      const status = event.target.value;
                      if (status)
                        void setPipelineState(
                          company,
                          status as 'PLANNING' | 'APPLIED' | 'EXCLUDED',
                        );
                      else void clearPipelineState(company);
                    }}
                  >
                    <option value="">Not tracked</option>
                    <option value="PLANNING">Planning</option>
                    <option value="APPLIED">Applied</option>
                    <option value="EXCLUDED">Excluded</option>
                  </select>
                </label>
                {safeExternalUrl(company.careerUrl) && (
                  <a href={safeExternalUrl(company.careerUrl)!} target="_blank" rel="noreferrer">
                    Careers
                  </a>
                )}
                {safeExternalUrl(company.websiteUrl) && (
                  <a href={safeExternalUrl(company.websiteUrl)!} target="_blank" rel="noreferrer">
                    Website
                  </a>
                )}
              </div>
            </article>
          ))}
          {companies.length === 0 && <p className="muted">No companies match this search.</p>}
        </section>
      )}
      {!loading && !error && (
        <nav aria-label="Company pages" className="admin-pagination">
          <button
            className="secondary"
            disabled={page <= 1 || savingId !== null}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span aria-live="polite">
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))} · {total} companies
          </span>
          <button
            className="secondary"
            disabled={page * pageSize >= total || page >= 10000 || savingId !== null}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
}
