'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../../lib/admin-api';
import {
  CONTROLLED_EXPERIENCE_LEVELS,
  type SaveCandidatePayload,
} from '../../../../lib/candidate-admin';
import type { Category } from '../../../../lib/company-intelligence';

export default function AdminNewCandidatePage() {
  const router = useRouter();
  const api = useAdminApi();
  const [categories, setCategories] = useState<Category[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [expertise, setExpertise] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [experienceYears, setExperienceYears] = useState<string>('');
  const [skills, setSkills] = useState('');
  const [preferredLocations, setPreferredLocations] = useState('');
  const [excludedLocations, setExcludedLocations] = useState('');
  const [preferredWorkModes, setPreferredWorkModes] = useState<string[]>(['Remote', 'Hybrid']);
  const [preferredCategories, setPreferredCategories] = useState<Set<string>>(new Set());
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());
  const [minimumMatchScore, setMinimumMatchScore] = useState<number>(70);
  const [newPassword, setNewPassword] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api<Category[]>('/admin/categories', { signal: controller.signal })
      .then((catalog) => setCategories(catalog))
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Failed to load category catalog.');
        }
      });
    return () => controller.abort();
  }, [api]);

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
    if (!name.trim()) {
      setError('Candidate name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    setCreating(true);
    setError('');

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
      const created = await api<{ id: string }>('/admin/candidates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      router.push(`/admin/candidates/${encodeURIComponent(created.id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create candidate profile.');
      setCreating(false);
    }
  }

  return (
    <section>
      <div className="mb-6">
        <p className="eyebrow">
          <Link href="/admin/candidates">← Back to Candidates</Link>
        </p>
        <h1>Add Candidate</h1>
        <p>Register a new candidate profile, match preferences, and initial credentials.</p>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form className="card form-grid" onSubmit={handleSubmit}>
        <div className="admin-fields">
          <label>
            Full name *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
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
              placeholder="candidate@example.com"
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
              placeholder="e.g. Senior Full-Stack Engineer"
              maxLength={500}
            />
          </label>

          <label>
            Initial password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank for system default"
              minLength={8}
            />
            <span className="muted text-xs">
              Candidate will be required to change password on first login.
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
            placeholder="e.g. TypeScript, React, Node.js, PostgreSQL, Docker"
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
          <button type="submit" disabled={creating}>
            {creating ? 'Registering candidate…' : 'Register Candidate'}
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
