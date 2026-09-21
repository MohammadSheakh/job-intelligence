'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(
    async (search = '') => {
      setLoading(true);
      setError('');
      try {
        const suffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
        setCompanies(await api<Company[]>(`/candidate/companies${suffix}`));
      } catch (reason) {
        const destination = candidateAuthRedirect(reason);
        if (destination) router.replace(destination);
        setError(reason instanceof Error ? reason.message : 'Companies could not be loaded.');
        if (reason instanceof Error && /unauthor/i.test(reason.message))
          router.replace('/candidate/login');
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void load();
  }, [load]);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(query);
  }
  async function setPipelineState(company: Company, status: 'PLANNING' | 'APPLIED' | 'EXCLUDED') {
    setSavingId(company.id);
    setError('');
    try {
      await api('/candidate/pipeline/company-state', {
        method: 'POST',
        body: JSON.stringify({ companyId: company.id, status }),
      });
      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id ? { ...item, trackingStatus: status } : item,
        ),
      );
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      setError(reason instanceof Error ? reason.message : 'Company status could not be saved.');
    } finally {
      setSavingId(null);
    }
  }
  async function clearPipelineState(company: Company) {
    setSavingId(company.id);
    setError('');
    try {
      await api(`/candidate/pipeline/${company.id}`, { method: 'DELETE' });
      setCompanies((current) =>
        current.map((item) => (item.id === company.id ? { ...item, trackingStatus: null } : item)),
      );
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      setError(reason instanceof Error ? reason.message : 'Company status could not be removed.');
    } finally {
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
      <form className="search" onSubmit={search}>
        <input
          aria-label="Search companies"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, location, or technology"
        />
        <button>Search</button>
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
                    disabled={savingId === company.id}
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
                {company.careerUrl && (
                  <a href={company.careerUrl} target="_blank" rel="noreferrer">
                    Careers
                  </a>
                )}
                {company.websiteUrl && (
                  <a href={company.websiteUrl} target="_blank" rel="noreferrer">
                    Website
                  </a>
                )}
              </div>
            </article>
          ))}
          {companies.length === 0 && <p className="muted">No companies match this search.</p>}
        </section>
      )}
    </main>
  );
}
