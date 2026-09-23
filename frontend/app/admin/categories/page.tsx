'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../lib/admin-api';
import type { Category } from '../../../lib/company-intelligence';

export default function AdminCategoriesPage() {
  const api = useAdminApi();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [name, setName] = useState('');
  const [type, setType] = useState<Category['type']>('technology');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<Category[]>('/admin/categories', { signal: controller.signal })
      .then(setCategories)
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Categories could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, retry]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), type }),
      });
      setCategories(await api<Category[]>('/admin/categories'));
      setName('');
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Category could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const technologies = categories.filter((c) => c.type === 'technology');
  const domains = categories.filter((c) => c.type === 'domain');
  const sectors = categories.filter((c) => c.type === 'sector');
  const others = categories.filter((c) => c.type === 'other');

  const renderSection = (title: string, items: Category[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-10">
        <h2 className="text-lg font-bold text-neutral-900 mb-3">{title}</h2>
        <table className="table-clean">
          <thead>
            <tr>
              <th>Category</th>
              <th className="text-right">Companies</th>
            </tr>
          </thead>
          <tbody>
            {items.map((cat) => (
              <tr key={cat.id} className="hover:bg-neutral-50/50 transition">
                <td className="font-medium text-neutral-900">
                  <button
                    type="button"
                    aria-label={`Edit ${cat.name}`}
                    onClick={() => {
                      setName(cat.name);
                      setType(cat.type);
                      setSaved(false);
                    }}
                    className="hover:underline text-left"
                    title="Click to edit"
                  >
                    {cat.name}
                  </button>
                </td>
                <td className="text-right text-sm text-neutral-600 font-mono">
                  {cat.companyCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-4xl">
      {/* Header matching Figma image 4 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Categories</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Technology, domain and sector classification
        </p>
      </div>

      {/* Add / Edit Category Form matching Figma image 4 */}
      <form onSubmit={save} className="border-b border-neutral-100 pb-8 mb-8">
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="w-full sm:w-96">
            <label htmlFor="category-name-input" className="text-xs font-semibold text-neutral-500 mb-1">
              Category name
            </label>
            <input
              id="category-name-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              placeholder="e.g. Generative AI"
              maxLength={120}
              className="input-clean"
              required
            />
          </div>
          <div className="w-full sm:w-64">
            <label htmlFor="category-type-select" className="text-xs font-semibold text-neutral-500 mb-1">
              Category type
            </label>
            <select
              id="category-type-select"
              value={type}
              onChange={(e) => setType(e.target.value as Category['type'])}
              aria-label="Category type"
              className="select-clean"
            >
              <option value="technology">Technology</option>
              <option value="domain">Domain</option>
              <option value="sector">Sector</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn-pill-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save category'}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 mb-6" role="alert">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <button
            onClick={() => setRetry((value) => value + 1)}
            className="btn-pill-secondary mt-2 text-xs"
          >
            Reload categories
          </button>
        </div>
      )}

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 mb-6">
          <p className="text-xs font-medium text-emerald-700">Category saved.</p>
        </div>
      )}

      {loading && <p className="py-8 text-sm text-neutral-400">Loading categories…</p>}

      {!loading && (
        <div>
          {renderSection('Technology', technologies)}
          {renderSection('Domain', domains)}
          {renderSection('Sector', sectors)}
          {renderSection('Other', others)}
        </div>
      )}
    </div>
  );
}
