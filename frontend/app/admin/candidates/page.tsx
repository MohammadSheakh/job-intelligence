'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../lib/admin-api';
import type { Category } from '../../../lib/company-intelligence';

interface CandidateRecord {
  id: string;
  name: string;
  email: string;
  expertise: string | null;
  skills: string | null;
  experienceLevel: string | null;
  preferredLocations: string | null;
  excludedLocations: string | null;
  preferredWorkModes: string | null;
  preferredCategories: string | null;
  excludedCategories: string | null;
  minimumMatchScore: number;
  active: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
}

export default function AdminCandidatesPage() {
  const api = useAdminApi();
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [expertise, setExpertise] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [skills, setSkills] = useState('');
  const [preferredLocations, setPreferredLocations] = useState('');
  const [excludedLocations, setExcludedLocations] = useState('');
  const [preferredWorkModes, setPreferredWorkModes] = useState('');
  const [minimumMatchScore, setMinimumMatchScore] = useState(70);
  const [newPassword, setNewPassword] = useState('');
  const [active, setActive] = useState(true);
  const [preferredCategories, setPreferredCategories] = useState<Set<string>>(new Set());
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());

  function resetForm() {
    setEditId(null);
    setName('');
    setEmail('');
    setExpertise('');
    setExperienceLevel('');
    setSkills('');
    setPreferredLocations('');
    setExcludedLocations('');
    setPreferredWorkModes('');
    setMinimumMatchScore(70);
    setNewPassword('');
    setActive(true);
    setPreferredCategories(new Set());
    setExcludedCategories(new Set());
  }

  function startEdit(candidate: CandidateRecord) {
    setEditId(candidate.id);
    setName(candidate.name);
    setEmail(candidate.email);
    setExpertise(candidate.expertise ?? '');
    setExperienceLevel(candidate.experienceLevel ?? '');
    setSkills(candidate.skills ?? '');
    setPreferredLocations(candidate.preferredLocations ?? '');
    setExcludedLocations(candidate.excludedLocations ?? '');
    setPreferredWorkModes(candidate.preferredWorkModes ?? '');
    setMinimumMatchScore(candidate.minimumMatchScore);
    setNewPassword('');
    setActive(candidate.active);

    const pref = new Set(
      (candidate.preferredCategories ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const excl = new Set(
      (candidate.excludedCategories ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    setPreferredCategories(pref);
    setExcludedCategories(excl);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const [candidateList, categoryList] = await Promise.all([
          api<CandidateRecord[]>('/admin/candidates', { signal }),
          api<Category[]>('/admin/categories', { signal }),
        ]);
        setCandidates(candidateList);
        setCategories(categoryList);
      } catch (err) {
        if (!signal?.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load candidates.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      name: name.trim(),
      email: email.trim(),
      expertise: expertise.trim() || undefined,
      experienceLevel: experienceLevel.trim() || undefined,
      skills: skills.trim() || undefined,
      preferredLocations: preferredLocations.trim() || undefined,
      excludedLocations: excludedLocations.trim() || undefined,
      preferredWorkModes: preferredWorkModes
        ? preferredWorkModes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      preferredCategories: Array.from(preferredCategories),
      excludedCategories: Array.from(excludedCategories),
      minimumMatchScore: Number(minimumMatchScore),
      active,
      newPassword: newPassword.trim() || undefined,
    };

    try {
      if (editId) {
        await api(`/admin/candidates/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess(`Candidate "${name}" updated successfully.`);
      } else {
        await api('/admin/candidates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess(`Candidate "${name}" added successfully.`);
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save candidate.');
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(cat: string, type: 'preferred' | 'excluded') {
    if (type === 'preferred') {
      const next = new Set(preferredCategories);
      if (next.has(cat)) next.delete(cat);
      else {
        next.add(cat);
        // Exclusions and preferences are mutually exclusive
        if (excludedCategories.has(cat)) {
          const nextExcl = new Set(excludedCategories);
          nextExcl.delete(cat);
          setExcludedCategories(nextExcl);
        }
      }
      setPreferredCategories(next);
    } else {
      const next = new Set(excludedCategories);
      if (next.has(cat)) next.delete(cat);
      else {
        next.add(cat);
        if (preferredCategories.has(cat)) {
          const nextPref = new Set(preferredCategories);
          nextPref.delete(cat);
          setPreferredCategories(nextPref);
        }
      }
      setExcludedCategories(next);
    }
  }

  // Group categories by type for readable presentation
  const groupedCategories = categories
    .filter((c) => c.name !== 'Other')
    .reduce<Record<string, Category[]>>((acc, cat) => {
      const key = cat.type || 'general';
      if (!acc[key]) acc[key] = [];
      acc[key].push(cat);
      return acc;
    }, {});

  return (
    <>
      <div className="flex flex-col gap-1 mb-6">
        <h1>Candidate Management</h1>
        <p>Manage candidate profiles, match criteria, and authentication credentials.</p>
      </div>

      {success && (
        <p className="success mb-4" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="error mb-4" role="alert">
          {error}
        </p>
      )}

      {/* Add / Edit Form Card */}
      <form className="card mb-8" onSubmit={handleSubmit}>
        <h2>{editId ? 'Edit candidate profile' : 'Add new candidate'}</h2>
        <p className="text-xs text-slate-600 mb-4">
          Candidates must be registered by an administrator before they can log in.
        </p>

        <div className="admin-fields gap-4">
          <label>
            Full Name
            <input
              required
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Doe"
              maxLength={120}
            />
          </label>
          <label>
            Email Address
            <input
              required
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              maxLength={320}
            />
          </label>
          <label>
            Primary Expertise
            <input
              name="expertise"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              maxLength={500}
            />
          </label>
          <label>
            Experience Level
            <input
              name="experienceLevel"
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              placeholder="junior / mid / senior"
              maxLength={80}
            />
          </label>
          <label className="sm:col-span-2">
            Skills (comma-separated)
            <input
              name="skills"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Node.js, TypeScript, PostgreSQL, Docker"
              maxLength={1000}
            />
          </label>
          <label>
            Preferred Locations
            <input
              name="preferredLocations"
              value={preferredLocations}
              onChange={(e) => setPreferredLocations(e.target.value)}
              placeholder="Gulshan, Banani, Remote"
              maxLength={1000}
            />
          </label>
          <label>
            Excluded Locations
            <input
              name="excludedLocations"
              value={excludedLocations}
              onChange={(e) => setExcludedLocations(e.target.value)}
              placeholder="Chittagong, Savar"
              maxLength={1000}
            />
          </label>
          <label>
            Preferred Work Modes
            <input
              name="preferredWorkModes"
              value={preferredWorkModes}
              onChange={(e) => setPreferredWorkModes(e.target.value)}
              placeholder="Remote, Hybrid, Onsite"
              maxLength={200}
            />
          </label>
          <label>
            Minimum Match Score (0–100%)
            <input
              type="number"
              min={0}
              max={100}
              name="minimumMatchScore"
              value={minimumMatchScore}
              onChange={(e) => setMinimumMatchScore(Number(e.target.value))}
            />
          </label>
          <label className="sm:col-span-2">
            {editId
              ? 'Reset Password (optional)'
              : 'Initial Password (defaults to asdfasdf if empty)'}
            <input
              type="password"
              name="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              maxLength={256}
              placeholder={
                editId ? 'Leave blank to preserve existing password' : 'Min 8 characters'
              }
              autoComplete="new-password"
            />
          </label>
        </div>

        {/* Category Preferences Matrix */}
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-800">Category Preferences & Exclusions</p>
          <p className="text-xs text-slate-500 mb-4">
            Sector exclusions act as hard filters. Technology and domain exclusions block matching
            jobs.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(groupedCategories).map(([group, cats]) => (
              <div key={group} className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  {group}
                </p>
                <div className="space-y-1.5">
                  {cats.map((cat) => {
                    const isPref = preferredCategories.has(cat.name);
                    const isExcl = excludedCategories.has(cat.name);
                    return (
                      <div key={cat.id} className="flex items-center justify-between text-xs">
                        <span className="truncate mr-2 font-medium text-slate-700">{cat.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="m-0 flex items-center gap-1 font-normal cursor-pointer">
                            <input
                              type="checkbox"
                              className="size-3.5 m-0"
                              checked={isPref}
                              onChange={() => toggleCategory(cat.name, 'preferred')}
                            />
                            <span
                              className={isPref ? 'text-emerald-700 font-bold' : 'text-slate-500'}
                            >
                              Prefer
                            </span>
                          </label>
                          <label className="m-0 flex items-center gap-1 font-normal cursor-pointer">
                            <input
                              type="checkbox"
                              className="size-3.5 m-0"
                              checked={isExcl}
                              onChange={() => toggleCategory(cat.name, 'excluded')}
                            />
                            <span className={isExcl ? 'text-red-700 font-bold' : 'text-slate-500'}>
                              Exclude
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="active-checkbox"
            className="size-4 m-0"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <label htmlFor="active-checkbox" className="m-0 text-sm font-medium text-slate-800">
            Account Active
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={saving} className="px-6">
            {saving ? 'Saving…' : editId ? 'Save Candidate' : 'Add Candidate'}
          </button>
          {editId && (
            <button type="button" className="secondary" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* Candidates List Table */}
      <div className="flex items-center justify-between mb-3">
        <h2>Candidates Catalog ({candidates.length})</h2>
      </div>

      {loading ? (
        <section className="card">
          <p className="muted">Loading candidate accounts…</p>
        </section>
      ) : candidates.length === 0 ? (
        <section className="card">
          <p className="muted">No candidate accounts found. Add your first candidate above.</p>
        </section>
      ) : (
        <div className="admin-table-wrap card p-0 overflow-hidden mb-8">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Expertise & Skills</th>
                <th>Preferred</th>
                <th>Excluded</th>
                <th>Threshold</th>
                <th>Auth</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{candidate.name}</div>
                    <div className="text-xs text-slate-600">{candidate.email}</div>
                  </td>
                  <td>
                    <div className="text-xs font-medium text-slate-800">
                      {candidate.expertise || '—'}
                    </div>
                    {candidate.skills && (
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {candidate.skills}
                      </div>
                    )}
                  </td>
                  <td className="text-xs">
                    <div>{candidate.preferredLocations || '—'}</div>
                    {candidate.preferredCategories && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {candidate.preferredCategories.split(',').map((cat) => (
                          <span
                            key={cat}
                            className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                          >
                            {cat.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="text-xs">
                    <div>{candidate.excludedLocations || '—'}</div>
                    {candidate.excludedCategories && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {candidate.excludedCategories.split(',').map((cat) => (
                          <span
                            key={cat}
                            className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-800"
                          >
                            {cat.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs font-semibold text-slate-700">
                    {candidate.minimumMatchScore}%
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-1">
                      {candidate.hasPassword && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                          Password
                        </span>
                      )}
                      {candidate.hasGoogle && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          Google
                        </span>
                      )}
                      {!candidate.hasPassword && !candidate.hasGoogle && (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        candidate.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {candidate.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      className="secondary text-xs py-1 px-3"
                      onClick={() => startEdit(candidate)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
