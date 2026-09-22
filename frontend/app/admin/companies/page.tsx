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
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h1>Companies</h1>
          <p>Review company research, hiring pages, and category assignments.</p>
        </div>
        <Link
          href="/admin/companies/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.5rem 1.25rem',
            borderRadius: '9999px',
            backgroundColor: '#111114',
            color: '#ffffff',
            fontWeight: 500,
            textDecoration: 'none',
            fontSize: '0.875rem',
          }}
        >
          + Add Company
        </Link>
      </div>
      <form className="admin-filters" onSubmit={search}>
        <label>
          Search companies
          <input
            name="search"
            defaultValue={filters.search}
            placeholder="Name, website, or location"
            maxLength={200}
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={filters.category} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Research action
          <select name="action" defaultValue={filters.action} aria-label="Research action">
            <option value="">All actions</option>
            {companyActions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review queue
          <select
            name="needsManualReview"
            defaultValue={filters.needsManualReview}
            aria-label="Review queue"
          >
            <option value="">All review states</option>
            <option value="true">Needs manual review</option>
            <option value="false">Review not required</option>
          </select>
        </label>
        <button disabled={loading}>Search</button>
      </form>
      {error && (
        <div role="alert">
          <p className="error">{error}</p>
          <button onClick={() => setRetry((value) => value + 1)}>Retry</button>
        </div>
      )}
      {loading && <p role="status">Loading companies…</p>}
      {!loading && !error && result && (
        <>
          <p role="status">
            {result.total} {result.total === 1 ? 'company' : 'companies'} · Page {result.page} of{' '}
            {Math.max(1, Math.ceil(result.total / result.pageSize))}
          </p>
          {result.rows.length === 0 ? (
            <p className="card">No companies match these filters.</p>
          ) : (
            <div className="admin-table-wrap">
              <table>
                <caption className="sr-only">Company search results</caption>
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">Links</th>
                    <th scope="col">Categories</th>
                    <th scope="col">Research</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((company) => (
                    <tr key={company.id}>
                      <td>
                        <Link href={`/admin/companies/${encodeURIComponent(company.id)}`}>
                          <strong>{company.name}</strong>
                        </Link>
                        <p>{company.location || 'Location not set'}</p>
                      </td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {company.websiteUrl ? (
                            <a
                              href={company.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#111114', textDecoration: 'underline' }}
                            >
                              Website ↗
                            </a>
                          ) : null}
                          {company.careerUrl ? (
                            <a
                              href={company.careerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#111114', textDecoration: 'underline' }}
                            >
                              Career page ↗
                            </a>
                          ) : null}
                          {company.linkedinUrl ? (
                            <a
                              href={company.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#6e6e73', textDecoration: 'underline' }}
                            >
                              LinkedIn ↗
                            </a>
                          ) : null}
                          {!company.websiteUrl && !company.careerUrl && !company.linkedinUrl && (
                            <span style={{ color: '#8e8e93' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>{company.categories.join(', ') || 'Uncategorized'}</td>
                      <td>
                        <div>
                          {companyActions.find(
                            ([value]) => value === company.recommendedAction,
                          )?.[1] ??
                            company.recommendedAction ??
                            'Not set'}
                        </div>
                        {company.needsManualReview && (
                          <div style={{ marginTop: '0.25rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.125rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                              }}
                            >
                              Needs manual review
                            </span>
                            {company.reviewReasons && (
                              <p
                                style={{
                                  marginTop: '0.25rem',
                                  color: '#6e6e73',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {company.reviewReasons}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td>{company.active ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="admin-pagination">
            <button
              className="secondary"
              disabled={filters.page === 1}
              onClick={() => setFilters((value) => ({ ...value, page: value.page - 1 }))}
            >
              Previous
            </button>
            <button
              className="secondary"
              disabled={result.page * result.pageSize >= result.total}
              onClick={() => setFilters((value) => ({ ...value, page: value.page + 1 }))}
            >
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}
