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
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <p className="eyebrow">
            <Link href="/admin/candidates">← Back to Candidates</Link>
          </p>
          <h1>{candidate?.name || `Candidate #${id}`}</h1>
          <p>
            Candidate ID: <code className="font-mono text-xs">#{id}</code> ·{' '}
            <span
              className={`font-semibold ${
                candidate?.active ? 'text-emerald-700' : 'text-neutral-500'
              }`}
            >
              {candidate?.active ? 'Active Account' : 'Inactive Account'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {candidate?.hasPassword ? (
            <span className="status bg-neutral-100 text-neutral-800">🔑 Password active</span>
          ) : (
            <span className="status bg-amber-50 text-amber-800">No password</span>
          )}
          {candidate?.hasGoogle && (
            <span className="status bg-blue-50 text-blue-800">🌐 Google linked</span>
          )}
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="success" role="status">
          {success}
        </p>
      )}

      <form className="card form-grid" onSubmit={handleSubmit}>
        <div className="admin-fields">
          <label>
            Full name *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
            />
          </label>

          <label>
            Email address *
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={320}
              required
            />
          </label>
        </div>

        <div className="admin-fields">
          <label>
            Primary role / expertise
            <input
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              placeholder="e.g. Lead Backend Engineer"
              maxLength={500}
            />
          </label>

          <label>
            Reset password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to preserve current password"
              minLength={8}
            />
            <span className="muted text-xs">
              If changed, the candidate must use the new password upon subsequent sign-in.
            </span>
          </label>
        </div>

        <div className="admin-fields">
          <label>
            Experience level
            <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
              <option value="">Select level…</option>
              {CONTROLLED_EXPERIENCE_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </label>

          <label>
            Years of experience
            <input
              type="number"
              min="0"
              max="70"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              placeholder="e.g. 5"
            />
            <span className="muted text-xs">
              Used for exact numeric year compatibility in job matching.
            </span>
          </label>
        </div>

        <label>
          Skills (comma-separated)
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="e.g. TypeScript, React, Node.js, PostgreSQL"
            maxLength={1000}
          />
        </label>

        <div className="admin-fields">
          <label>
            Preferred locations
            <input
              value={preferredLocations}
              onChange={(e) => setPreferredLocations(e.target.value)}
              placeholder="e.g. Dhaka, Remote"
              maxLength={1000}
            />
          </label>

          <label>
            Excluded locations
            <input
              value={excludedLocations}
              onChange={(e) => setExcludedLocations(e.target.value)}
              placeholder="e.g. Chittagong"
              maxLength={1000}
            />
          </label>
        </div>

        <fieldset>
          <legend>Preferred work modes</legend>
          <div className="check-list mt-2">
            {['Remote', 'Hybrid', 'On-site'].map((mode) => (
              <label key={mode} className="check">
                <input
                  type="checkbox"
                  checked={preferredWorkModes.includes(mode)}
                  onChange={() => toggleWorkMode(mode)}
                />
                {mode}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Category preferences &amp; exclusions</legend>
          <p className="muted text-xs mb-3">
            Check preferred categories to prioritize relevant companies. Excluded categories take
            strict precedence.
          </p>
          <div className="grid gap-2 max-h-60 overflow-y-auto p-1">
            {categories.map((cat) => {
              const isPref = preferredCategories.has(cat.name);
              const isExcl = excludedCategories.has(cat.name);
              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between border-b border-neutral-100 py-1 text-xs"
                >
                  <span>
                    <strong>{cat.name}</strong> <span className="muted">({cat.type})</span>
                  </span>
                  <div className="flex gap-3">
                    <label className="check m-0">
                      <input
                        type="checkbox"
                        checked={isPref}
                        onChange={() => toggleCategory(cat.name, 'preferred')}
                      />
                      Prefer
                    </label>
                    <label className="check m-0 text-red-700">
                      <input
                        type="checkbox"
                        checked={isExcl}
                        onChange={() => toggleCategory(cat.name, 'excluded')}
                      />
                      Exclude
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="admin-fields items-center">
          <label>
            Minimum match score ({minimumMatchScore}%)
            <input
              type="range"
              min="0"
              max="100"
              value={minimumMatchScore}
              onChange={(e) => setMinimumMatchScore(parseInt(e.target.value, 10))}
            />
          </label>

          <div className="mt-4">
            <label className="check font-semibold">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Account active (enabled for daily matching &amp; sign-in)
            </label>
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving changes…' : 'Save Changes'}
          </button>
          <Link
            href="/admin/candidates"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-neutral-200 mt-5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
