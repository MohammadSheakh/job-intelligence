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
  const [completingReview, setCompletingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [enrichmentMsg, setEnrichmentMsg] = useState('');
  const [enrichWebsiteOverride, setEnrichWebsiteOverride] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCompany(null);
    setError('');
    setSaved(false);
    setReviewMsg('');
    setEnrichmentMsg('');
    Promise.all([
      api<CompanyDetail>(`/admin/companies/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      }),
      api<Category[]>('/admin/categories', { signal: controller.signal }),
    ])
      .then(([detail, catalog]) => {
        setCompany(detail);
        setCategories(catalog);
        if (detail.websiteUrl) {
          setEnrichWebsiteOverride(detail.websiteUrl);
        }
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
          categories: form.getAll('categories').map(String),
        }),
      });
      const refreshed = await api<CompanyDetail>(`/admin/companies/${encodeURIComponent(id)}`);
      setCompany(refreshed);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Company could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function completeReview() {
    setCompletingReview(true);
    setError('');
    setReviewMsg('');
    try {
      const res = await api<{
        ok: boolean;
        recommendedAction: string;
        needsManualReview: boolean;
      }>(`/admin/companies/${encodeURIComponent(id)}/complete-review`, {
        method: 'POST',
      });
      const refreshed = await api<CompanyDetail>(`/admin/companies/${encodeURIComponent(id)}`);
      setCompany(refreshed);
      setReviewMsg(
        `Manual review completed! Recommended action recalculated to "${res.recommendedAction}".`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Review could not be completed.');
    } finally {
      setCompletingReview(false);
    }
  }

  async function enrichCompany() {
    setEnriching(true);
    setError('');
    setEnrichmentMsg('');
    try {
      const res = await api<{
        ok: boolean;
        recommendedAction: string;
        careerUrl: string | null;
        discoveredFromHtml: boolean;
      }>(`/admin/companies/${encodeURIComponent(id)}/enrich`, {
        method: 'POST',
        body: JSON.stringify({
          websiteUrl: enrichWebsiteOverride.trim() || undefined,
        }),
      });
      const refreshed = await api<CompanyDetail>(`/admin/companies/${encodeURIComponent(id)}`);
      setCompany(refreshed);
      setEnrichmentMsg(
        res.discoveredFromHtml
          ? `Enrichment successful: Discovered career page "${res.careerUrl}" and updated status to "${res.recommendedAction}".`
          : `Enrichment processed: Status updated to "${res.recommendedAction}". ${res.careerUrl ? 'Career page confirmed.' : 'No career link found on homepage.'}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enrichment failed.');
    } finally {
      setEnriching(false);
    }
  }

  return (
    <>
      <Link href="/admin/companies">← Back to companies</Link>
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
        <>
          {company.needsManualReview && (
            <div
              style={{
                border: '1px solid #fde68a',
                backgroundColor: '#fefce8',
                borderRadius: '10px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
              role="region"
              aria-label="Manual review queue details"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      marginBottom: '0.5rem',
                    }}
                  >
                    NEEDS MANUAL REVIEW
                  </span>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
                    Review Required
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563' }}>
                    Reason: {company.reviewReasons || 'No specific review reason recorded.'}
                  </p>
                  {(company.nameSource || company.sourceRows) && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                      Source: {company.nameSource || 'inferred'} · Rows:{' '}
                      {company.sourceRows || 'none'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={completeReview}
                  disabled={completingReview}
                  style={{
                    backgroundColor: '#111114',
                    color: '#ffffff',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    cursor: completingReview ? 'not-allowed' : 'pointer',
                  }}
                >
                  {completingReview ? 'Completing…' : 'Complete Review'}
                </button>
              </div>
              {reviewMsg && (
                <p
                  style={{
                    marginTop: '0.75rem',
                    marginBottom: 0,
                    fontSize: '0.875rem',
                    color: '#15803d',
                    fontWeight: 500,
                  }}
                >
                  {reviewMsg}
                </p>
              )}
            </div>
          )}

          {(company.recommendedAction === 'ENRICH_FROM_LINKEDIN' || company.needsEnrichment) && (
            <div
              style={{
                border: '1px solid #bfdbfe',
                backgroundColor: '#eff6ff',
                borderRadius: '10px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
              role="region"
              aria-label="Enrichment queue details"
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    marginBottom: '0.5rem',
                  }}
                >
                  ENRICHMENT QUEUE
                </span>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
                  Controlled Enrichment Lifecycle
                </h2>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>
                  {company.enrichmentReasons ||
                    'Official company website and hiring page need verification.'}
                </p>
                <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Inspects official website for career page without bypassing LinkedIn anti-bot
                  controls.
                </p>
                {company.linkedinUrl && (
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem' }}>
                    <a
                      href={company.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#2563eb', textDecoration: 'underline' }}
                    >
                      Open LinkedIn profile in new tab ↗
                    </a>
                  </p>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    placeholder="Official website URL (e.g. https://company.com)"
                    value={enrichWebsiteOverride}
                    onChange={(e) => setEnrichWebsiteOverride(e.target.value)}
                    style={{ flex: '1 1 300px', maxWidth: '450px' }}
                  />
                  <button
                    type="button"
                    onClick={enrichCompany}
                    disabled={enriching}
                    style={{
                      backgroundColor: '#1e40af',
                      color: '#ffffff',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '9999px',
                      fontSize: '0.875rem',
                      cursor: enriching ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {enriching ? 'Enriching…' : 'Enrich Company'}
                  </button>
                </div>
              </div>
              {enrichmentMsg && (
                <p
                  style={{
                    marginTop: '0.75rem',
                    marginBottom: 0,
                    fontSize: '0.875rem',
                    color: '#15803d',
                    fontWeight: 500,
                  }}
                >
                  {enrichmentMsg}
                </p>
              )}
            </div>
          )}

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    name="websiteUrl"
                    defaultValue={company.websiteUrl ?? ''}
                    maxLength={2000}
                    style={{ flex: 1 }}
                  />
                  {company.websiteUrl && (
                    <a
                      href={company.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.8125rem',
                        whiteSpace: 'nowrap',
                        textDecoration: 'underline',
                      }}
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              </label>
              <label>
                Career page
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    name="careerUrl"
                    defaultValue={company.careerUrl ?? ''}
                    maxLength={2000}
                    style={{ flex: 1 }}
                  />
                  {company.careerUrl && (
                    <a
                      href={company.careerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.8125rem',
                        whiteSpace: 'nowrap',
                        textDecoration: 'underline',
                      }}
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              </label>
              <label>
                LinkedIn URL
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    name="linkedinUrl"
                    defaultValue={company.linkedinUrl ?? ''}
                    maxLength={2000}
                    style={{ flex: 1 }}
                  />
                  {company.linkedinUrl && (
                    <a
                      href={company.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.8125rem',
                        whiteSpace: 'nowrap',
                        textDecoration: 'underline',
                      }}
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              </label>
              <label>
                Contact email
                <input
                  name="email"
                  type="email"
                  defaultValue={company.email ?? ''}
                  maxLength={320}
                />
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
        </>
      )}
    </>
  );
}
