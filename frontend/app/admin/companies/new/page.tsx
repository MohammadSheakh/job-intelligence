'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../../lib/admin-api';
import { companyActions, type Category } from '../../../../lib/company-intelligence';

export default function AdminNewCompanyPage() {
  const router = useRouter();
  const api = useAdminApi();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<Category[]>('/admin/categories', { signal: controller.signal })
      .then((catalog) => setCategories(catalog))
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Categories could not be loaded.');
      });
    return () => controller.abort();
  }, [api]);

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const name = text('name');
    if (!name) {
      setError('Company name is required.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const created = await api<{ id: string; name: string }>('/admin/companies', {
        method: 'POST',
        body: JSON.stringify({
          name,
          websiteUrl: text('websiteUrl') || undefined,
          careerUrl: text('careerUrl') || undefined,
          linkedinUrl: text('linkedinUrl') || undefined,
          email: text('email') || undefined,
          location: text('location') || undefined,
          techStack: text('techStack') || undefined,
          notes: text('notes') || undefined,
          recommendedAction: text('recommendedAction') || undefined,
          statusResearchHint: text('statusResearchHint') || undefined,
          active: form.has('active'),
          needsManualReview: form.has('needsManualReview'),
          reviewReasons: text('reviewReasons') || undefined,
          categories: form.getAll('categories').map(String),
        }),
      });
      router.push(`/admin/companies/${encodeURIComponent(created.id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Company could not be created.');
      setCreating(false);
    }
  }

  return (
    <>
      <Link href="/admin/companies">← Back to companies</Link>
      <h1>Add company</h1>
      <p>Register a new company profile, research links, and category assignments.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form className="card form-grid" onSubmit={createCompany}>
        <label>
          Company name <span style={{ color: '#dc2626' }}>*</span>
          <input
            name="name"
            placeholder="e.g. Acme Technologies"
            maxLength={300}
            required
            autoFocus
          />
        </label>
        <div className="admin-fields">
          <label>
            Website URL
            <input name="websiteUrl" placeholder="https://example.com" maxLength={2000} />
          </label>
          <label>
            Career page URL
            <input name="careerUrl" placeholder="https://example.com/careers" maxLength={2000} />
          </label>
          <label>
            LinkedIn URL
            <input
              name="linkedinUrl"
              placeholder="https://www.linkedin.com/company/example"
              maxLength={2000}
            />
          </label>
          <label>
            Contact email
            <input name="email" type="email" placeholder="hr@example.com" maxLength={320} />
          </label>
          <label>
            Location
            <input name="location" placeholder="e.g. Dhaka, Bangladesh / Remote" maxLength={500} />
          </label>
          <label>
            Initial research action
            <select aria-label="Research action" name="recommendedAction" defaultValue="">
              <option value="">Auto-detect from URLs</option>
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
          <textarea
            name="techStack"
            placeholder="e.g. React, Node.js, PostgreSQL, Docker"
            maxLength={4000}
          />
        </label>
        <label>
          Research status hint
          <input
            name="statusResearchHint"
            placeholder="e.g. Hiring seasonally / Active on LinkedIn"
            maxLength={500}
          />
        </label>
        <label>
          Notes
          <textarea
            name="notes"
            placeholder="Internal admin notes regarding hiring practices or recruiter contacts"
            maxLength={10000}
          />
        </label>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}
        >
          <label className="check">
            <input name="active" type="checkbox" defaultChecked />
            Active company
          </label>
          <label className="check">
            <input name="needsManualReview" type="checkbox" />
            Flag for manual review
          </label>
        </div>
        <label>
          Review reasons (if flagged)
          <input
            name="reviewReasons"
            placeholder="e.g. Needs domain verification / Unconfirmed career portal"
            maxLength={2000}
          />
        </label>
        <fieldset>
          <legend>Company categories</legend>
          <p>Choose all that apply. Clearing every category assigns Other.</p>
          <div className="check-list">
            {categories.map((category) => (
              <label className="check" key={category.id}>
                <input name="categories" type="checkbox" value={category.name} />
                {category.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button disabled={creating}>{creating ? 'Creating…' : 'Create company'}</button>
          <Link
            href="/admin/companies"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.625rem 1.25rem',
              borderRadius: '9999px',
              backgroundColor: '#f4f4f5',
              color: '#18181b',
              fontWeight: 500,
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
