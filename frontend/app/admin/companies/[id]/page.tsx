'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../../lib/admin-api';
import {
  companyActions,
  type Category,
  type CompanyDetail,
} from '../../../../lib/company-intelligence';

export default function AdminCompanyPage() {
  const { id } = useParams<{ id: string }>();
  const api = useAdminApi();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCompany(null);
    setError('');
    setSaved(false);
    Promise.all([
      api<CompanyDetail>(`/admin/companies/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      }),
      api<Category[]>('/admin/categories', { signal: controller.signal }),
    ])
      .then(([detail, catalog]) => {
        setCompany(detail);
        setCategories(catalog);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Company could not be loaded.');
      });
    return () => controller.abort();
  }, [api, id, retry]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api(`/admin/companies/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: text('name'),
          websiteUrl: text('websiteUrl'),
          careerUrl: text('careerUrl'),
          linkedinUrl: text('linkedinUrl'),
          email: text('email') || undefined,
          location: text('location'),
          techStack: text('techStack'),
          notes: text('notes'),
          recommendedAction: text('recommendedAction') || undefined,
          statusResearchHint: text('statusResearchHint'),
          active: form.has('active'),
          categories: form.getAll('categories').map(String),
        }),
      });
      setCompany(await api<CompanyDetail>(`/admin/companies/${encodeURIComponent(id)}`));
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Company could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link href="/admin/companies">Back to companies</Link>
      <h1>{company?.name ?? 'Company details'}</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!company ? (
        error ? (
          <button onClick={() => setRetry((value) => value + 1)}>Retry</button>
        ) : (
          <p role="status">Loading company…</p>
        )
      ) : (
        <form key={JSON.stringify(company)} className="card form-grid" onSubmit={save}>
          <p>
            Last checked:{' '}
            {company.lastCheckedAt
              ? new Date(company.lastCheckedAt).toLocaleString()
              : 'Not yet checked'}
          </p>
          <label>
            Company name
            <input name="name" defaultValue={company.name} maxLength={300} required />
          </label>
          <div className="admin-fields">
            <label>
              Website
              <input name="websiteUrl" defaultValue={company.websiteUrl ?? ''} maxLength={2000} />
            </label>
            <label>
              Career page
              <input name="careerUrl" defaultValue={company.careerUrl ?? ''} maxLength={2000} />
            </label>
            <label>
              LinkedIn URL
              <input name="linkedinUrl" defaultValue={company.linkedinUrl ?? ''} maxLength={2000} />
            </label>
            <label>
              Contact email
              <input name="email" type="email" defaultValue={company.email ?? ''} maxLength={320} />
            </label>
            <label>
              Location
              <input name="location" defaultValue={company.location ?? ''} maxLength={500} />
            </label>
            <label>
              Research action
              <select
                aria-label="Research action"
                name="recommendedAction"
                defaultValue={company.recommendedAction ?? ''}
              >
                <option value="">Not set</option>
                {company.recommendedAction &&
                  !companyActions.some(([value]) => value === company.recommendedAction) && (
                    <option value={company.recommendedAction} disabled>
                      {company.recommendedAction} (choose a supported action)
                    </option>
                  )}
                {companyActions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Technology stack
            <textarea name="techStack" defaultValue={company.techStack ?? ''} maxLength={4000} />
          </label>
          <label>
            Research status hint
            <input
              name="statusResearchHint"
              defaultValue={company.statusResearchHint ?? ''}
              maxLength={500}
            />
          </label>
          <label>
            Notes
            <textarea name="notes" defaultValue={company.notes ?? ''} maxLength={10000} />
          </label>
          <label className="check">
            <input name="active" type="checkbox" defaultChecked={company.active} />
            Active company
          </label>
          <fieldset>
            <legend>Company categories</legend>
            <p>Choose all that apply. Clearing every category assigns Other.</p>
            <div className="check-list">
              {categories.map((category) => (
                <label className="check" key={category.id}>
                  <input
                    name="categories"
                    type="checkbox"
                    value={category.name}
                    defaultChecked={company.categories.includes(category.name)}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </fieldset>
          {saved && (
            <p className="success" role="status">
              Company saved.
            </p>
          )}
          <button disabled={saving}>{saving ? 'Saving…' : 'Save company'}</button>
        </form>
      )}
    </>
  );
}
