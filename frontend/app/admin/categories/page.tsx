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

  return (
    <>
      <h1>Categories</h1>
      <p>Create a category or select an existing category to change its type.</p>
      <form className="card admin-filters" onSubmit={save}>
        <label>
          Category name
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            maxLength={120}
            required
          />
        </label>
        <label>
          Category type
          <select
            aria-label="Category type"
            value={type}
            onChange={(event) => setType(event.target.value as Category['type'])}
          >
            <option value="technology">Technology</option>
            <option value="domain">Domain</option>
            <option value="sector">Sector</option>
            <option value="other">Other</option>
          </select>
        </label>
        <button disabled={saving}>{saving ? 'Saving…' : 'Save category'}</button>
      </form>
      {error && (
        <div role="alert">
          <p className="error">{error}</p>
          <button onClick={() => setRetry((value) => value + 1)}>Reload categories</button>
        </div>
      )}
      {saved && (
        <p className="success" role="status">
          Category saved.
        </p>
      )}
      {loading ? (
        <p role="status">Loading categories…</p>
      ) : categories.length === 0 ? (
        <p>No categories yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <caption className="sr-only">Category catalog</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Type</th>
                <th scope="col">Companies</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.type}</td>
                  <td>{category.companyCount}</td>
                  <td>
                    <button
                      className="secondary"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => {
                        setName(category.name);
                        setType(category.type);
                        setSaved(false);
                      }}
                    >
                      {'Edit'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">Other counts only companies with no meaningful category.</p>
    </>
  );
}
