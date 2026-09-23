'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../../lib/admin-api';
import {
  CONTROLLED_EXPERIENCE_LEVELS,
  type CandidateAdminRecord,
  type SaveCandidatePayload,
} from '../../../../lib/candidate-admin';
import type { Category } from '../../../../lib/company-intelligence';

export default function AdminCandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useAdminApi();
  const [candidate, setCandidate] = useState<CandidateAdminRecord | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [expertise, setExpertise] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [experienceYears, setExperienceYears] = useState<string>('');
  const [skills, setSkills] = useState('');
  const [preferredLocations, setPreferredLocations] = useState('');
  const [excludedLocations, setExcludedLocations] = useState('');
  const [preferredWorkModes, setPreferredWorkModes] = useState<string[]>([]);
  const [preferredCategories, setPreferredCategories] = useState<Set<string>>(new Set());
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());
  const [minimumMatchScore, setMinimumMatchScore] = useState<number>(70);
  const [newPassword, setNewPassword] = useState('');
  const [active, setActive] = useState(true);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const [c, catList] = await Promise.all([
          api<CandidateAdminRecord>(`/admin/candidates/${encodeURIComponent(id)}`, { signal }),
          api<Category[]>('/admin/categories', { signal }),
        ]);
        setCandidate(c);
        setCategories(catList);

        // Populate form
        setName(c.name);
        setEmail(c.email);
        setExpertise(c.expertise ?? '');
        setExperienceLevel(c.experienceLevel ?? '');
        setExperienceYears(c.experienceYears != null ? String(c.experienceYears) : '');
        setSkills(c.skills ?? '');
        setPreferredLocations(c.preferredLocations ?? '');
        setExcludedLocations(c.excludedLocations ?? '');
        setPreferredWorkModes(
          (c.preferredWorkModes ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        );
        setMinimumMatchScore(c.minimumMatchScore);
        setActive(c.active);
        setNewPassword('');

        const pref = new Set(
          (c.preferredCategories ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        );
        const excl = new Set(
          (c.excludedCategories ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        );
        setPreferredCategories(pref);
        setExcludedCategories(excl);
      } catch (reason) {
        if (!signal?.aborted) {
          setError(reason instanceof Error ? reason.message : 'Failed to load candidate details.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [api, id],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  function toggleWorkMode(mode: string) {
    setPreferredWorkModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );
  }

  function toggleCategory(catName: string, type: 'preferred' | 'excluded') {
    if (type === 'preferred') {
      setPreferredCategories((prev) => {
        const next = new Set(prev);
        if (next.has(catName)) {
          next.delete(catName);
        } else {
          next.add(catName);
          setExcludedCategories((excl) => {
            const nextExcl = new Set(excl);
            nextExcl.delete(catName);
            return nextExcl;
          });
        }
        return next;
      });
    } else {
      setExcludedCategories((prev) => {
        const next = new Set(prev);
        if (next.has(catName)) {
          next.delete(catName);
        } else {
          next.add(catName);
          setPreferredCategories((pref) => {
            const nextPref = new Set(pref);
            nextPref.delete(catName);
            return nextPref;
          });
        }
        return next;
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    if (!name.trim()) {
      setError('Candidate name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const parsedYears = experienceYears.trim() !== '' ? parseInt(experienceYears, 10) : null;

    const payload: SaveCandidatePayload = {
      name: name.trim(),
      email: email.trim(),
      expertise: expertise.trim() || undefined,
      experienceLevel: experienceLevel || undefined,
      experienceYears: parsedYears !== null && !isNaN(parsedYears) ? parsedYears : null,
      skills: skills.trim() || undefined,
      preferredLocations: preferredLocations.trim() || undefined,
      excludedLocations: excludedLocations.trim() || undefined,
      preferredWorkModes,
      preferredCategories: Array.from(preferredCategories),
      excludedCategories: Array.from(excludedCategories),
      minimumMatchScore,
      active,
      newPassword: newPassword.trim() || undefined,
    };

    try {
      await api(`/admin/candidates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSuccess('Candidate profile updated successfully.');
      setNewPassword('');
      // Reload candidate data to reflect any server-side transformations
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to update candidate profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section>
        <p className="eyebrow">
          <Link href="/admin/candidates">← Back to Candidates</Link>
        </p>
        <p className="muted mt-4">Loading candidate profile…</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs text-neutral-400 mb-2">
            <Link href="/admin/candidates" className="hover:text-neutral-900 transition font-medium">← Back to Candidates</Link>
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 mb-1">
            {candidate?.name || `Candidate #${id}`}
          </h1>
          <p className="text-sm text-neutral-500">
            Candidate ID: <code className="font-mono text-xs">#{id}</code> ·{' '}
            <span
              className={`font-semibold ${
                candidate?.active ? 'text-emerald-700' : 'text-neutral-500'
              }`}
            >
              {candidate?.active ? 'Active' : 'Inactive'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {candidate?.hasPassword && (
            <span className="badge-neutral text-xs">Password active</span>
          )}
          {candidate?.hasGoogle && (
            <span className="badge-neutral text-xs">Google linked</span>
          )}
        </div>
      </div>

      <div className="border-b border-neutral-100 pb-2"></div>

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl" role="status">
          {success}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              className="input-clean w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={320}
              required
              className="input-clean w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Expertise</label>
            <input
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              placeholder="e.g. Lead Backend Engineer"
              maxLength={500}
              className="input-clean w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Experience level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="select-clean w-full"
              >
                <option value="">junior / mid / senior</option>
                {CONTROLLED_EXPERIENCE_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Years</label>
              <input
                type="number"
                min="0"
                max="70"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="e.g. 5"
                className="input-clean w-full"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Skills</label>
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Node.js, TypeScript, PostgreSQL"
            maxLength={1000}
            className="input-clean w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Preferred locations</label>
            <input
              value={preferredLocations}
              onChange={(e) => setPreferredLocations(e.target.value)}
              placeholder="Gulshan, Badda"
              maxLength={1000}
              className="input-clean w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Excluded locations</label>
            <input
              value={excludedLocations}
              onChange={(e) => setExcludedLocations(e.target.value)}
              placeholder="Uttara, Savar"
              maxLength={1000}
              className="input-clean w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Preferred work modes</label>
            <div className="flex items-center gap-4 pt-1">
              {['Remote', 'Hybrid', 'On-site'].map((mode) => (
                <label key={mode} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800">
                  <input
                    type="checkbox"
                    checked={preferredWorkModes.includes(mode)}
                    onChange={() => toggleWorkMode(mode)}
                    className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-4"
                  />
                  {mode}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Minimum match score</label>
            <input
              type="number"
              min="0"
              max="100"
              value={minimumMatchScore}
              onChange={(e) => setMinimumMatchScore(parseInt(e.target.value, 10))}
              className="input-clean w-full"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Reset login password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to preserve current password"
              minLength={8}
              className="input-clean w-full"
            />
          </div>
        </div>

        {/* Category preferences */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900 mb-0.5">Category preferences</h2>
            <p className="text-xs text-neutral-500">
              Sector exclusions are hard filters. Technology/domain exclusions only block jobs that explicitly match that category.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Technology Column */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-2 mb-3">
                Technology
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {categories
                  .filter((c) => c.type.toLowerCase() === 'technology')
                  .map((cat) => {
                    const isPref = preferredCategories.has(cat.name);
                    const isExcl = excludedCategories.has(cat.name);
                    return (
                      <div key={cat.id} className="flex items-center justify-between text-xs py-1 border-b border-neutral-50">
                        <span className="font-medium text-neutral-800 truncate mr-2">{cat.name}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] text-neutral-600">
                            <input
                              type="checkbox"
                              checked={isPref}
                              onChange={() => toggleCategory(cat.name, 'preferred')}
                              className="rounded border-neutral-300 text-neutral-950 size-3.5"
                            />
                            Prefer
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] text-rose-600">
                            <input
                              type="checkbox"
                              checked={isExcl}
                              onChange={() => toggleCategory(cat.name, 'excluded')}
                              className="rounded border-neutral-300 text-rose-600 size-3.5"
                            />
                            Exclude
                          </label>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Domain Column */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-2 mb-3">
                Domain
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {categories
                  .filter((c) => c.type.toLowerCase() === 'domain')
                  .map((cat) => {
                    const isPref = preferredCategories.has(cat.name);
                    const isExcl = excludedCategories.has(cat.name);
                    return (
                      <div key={cat.id} className="flex items-center justify-between text-xs py-1 border-b border-neutral-50">
                        <span className="font-medium text-neutral-800 truncate mr-2">{cat.name}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] text-neutral-600">
                            <input
                              type="checkbox"
                              checked={isPref}
                              onChange={() => toggleCategory(cat.name, 'preferred')}
                              className="rounded border-neutral-300 text-neutral-950 size-3.5"
                            />
                            Prefer
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] text-rose-600">
                            <input
                              type="checkbox"
                              checked={isExcl}
                              onChange={() => toggleCategory(cat.name, 'excluded')}
                              className="rounded border-neutral-300 text-rose-600 size-3.5"
                            />
                            Exclude
                          </label>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Sector Column */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-2 mb-3">
                Sector
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {categories
                  .filter((c) => c.type.toLowerCase() === 'sector')
                  .map((cat) => {
                    const isPref = preferredCategories.has(cat.name);
                    const isExcl = excludedCategories.has(cat.name);
                    return (
                      <div key={cat.id} className="flex items-center justify-between text-xs py-1 border-b border-neutral-50">
                        <span className="font-medium text-neutral-800 truncate mr-2">{cat.name}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] text-neutral-600">
                            <input
                              type="checkbox"
                              checked={isPref}
                              onChange={() => toggleCategory(cat.name, 'preferred')}
                              className="rounded border-neutral-300 text-neutral-950 size-3.5"
                            />
                            Prefer
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] text-rose-600">
                            <input
                              type="checkbox"
                              checked={isExcl}
                              onChange={() => toggleCategory(cat.name, 'excluded')}
                              className="rounded border-neutral-300 text-rose-600 size-3.5"
                            />
                            Exclude
                          </label>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-neutral-900">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-4"
            />
            Active
          </label>
        </div>

        <div className="pt-4 flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-pill-primary px-6 py-2.5 text-sm">
            {saving ? 'Saving changes…' : 'Save candidate'}
          </button>
          <Link
            href="/admin/candidates"
            className="btn-pill-secondary px-6 py-2.5 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
