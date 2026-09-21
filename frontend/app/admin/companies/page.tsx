'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../lib/admin-api';
import { companyActions, type Category, type CompanyPage } from '../../../lib/company-intelligence';

export default function AdminCompaniesPage() {
  const api = useAdminApi();
  const [filters, setFilters] = useState({ search: '', category: '', action: '', page: 1 });
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
    for (const key of ['search', 'category', 'action']) {
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
      page: 1,
    });
  }

  return (
    <>
      <h1>Companies</h1>
      <p>Review company research, hiring pages, and category assignments.</p>
      <form className="admin-filters" onSubmit={search}>
        <label>
          Search companies
          <input name="search" placeholder="Name, website, or location" maxLength={200} />
        </label>
        <label>
          Category
          <select name="category" aria-label="Category">
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
          <select name="action" aria-label="Research action">
            <option value="">All actions</option>
            {companyActions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
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
                          {company.name}
                        </Link>
                        <p>{company.location || 'Location not set'}</p>
                      </td>
                      <td>{company.categories.join(', ') || 'Uncategorized'}</td>
                      <td>
                        {companyActions.find(
                          ([value]) => value === company.recommendedAction,
                        )?.[1] ??
                          company.recommendedAction ??
                          'Not set'}
                        {company.needsManualReview && <p>Needs manual review</p>}
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
