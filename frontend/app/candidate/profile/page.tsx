'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../../lib/api';
import { CandidateNav } from '../components/candidate-nav';

interface Profile {
  name: string;
  email: string;
  expertise: string | null;
  skills: string | null;
  experience_level: string | null;
  experience_years?: number | null;
  preferred_locations: string | null;
  excluded_locations: string | null;
  preferred_work_modes: string | null;
  preferred_categories: string | null;
  excluded_categories: string | null;
  minimum_match_score: number;
}

interface CategoryItem {
  name: string;
  type: string;
}

const CONTROLLED_LEVELS = [
  'Junior',
  'Mid',
  'Senior',
  'Lead/Principal',
  'Fresher/Entry',
  'Student/Intern',
  'Manager',
];

const split = (value: string | null) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

export default function CandidateProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      api<Profile>('/candidate/profile', { signal: controller.signal }),
      api<CategoryItem[]>('/candidate/categories', { signal: controller.signal }),
    ])
      .then(([candidate, catalog]) => {
        if (!controller.signal.aborted) {
          setProfile(candidate);
          setCategories(catalog);
        }
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        const destination = candidateAuthRedirect(reason);
        if (destination) router.replace(destination);
        else setError(reason instanceof Error ? reason.message : 'Profile could not be loaded.');
      });

    return () => controller.abort();
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const checked = (name: string) => form.getAll(name).map(String);
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      await api('/candidate/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.get('name'),
          expertise: form.get('expertise'),
          skills: form.get('skills'),
          experienceLevel: form.get('experienceLevel'),
          experienceYears:
            form.get('experienceYears') && String(form.get('experienceYears')).trim() !== ''
              ? Number(form.get('experienceYears'))
              : null,
          preferredLocations: form.get('preferredLocations'),
          excludedLocations: form.get('excludedLocations'),
          preferredWorkModes: checked('workModes'),
          preferredCategories: checked('preferredCategories'),
          excludedCategories: checked('excludedCategories'),
          minimumMatchScore: Number(form.get('minimumMatchScore')),
        }),
      });
      setSaved(true);
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      else setError(reason instanceof Error ? reason.message : 'Profile could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <CandidateNav />
        <main className="max-w-5xl mx-auto px-6 py-20 text-center flex-1">
          <p className={error ? 'text-rose-600 text-sm' : 'text-neutral-400 text-sm'}>
            {error || 'Loading your profile…'}
          </p>
        </main>
      </div>
    );
  }

  const preferred = new Set(split(profile.preferred_categories));
  const excluded = new Set(split(profile.excluded_categories));
  const workModes = new Set(split(profile.preferred_work_modes));

  const techCategories = categories.filter((c) => c.type === 'Technology');
  const domainCategories = categories.filter((c) => c.type === 'Domain');
  const sectorCategories = categories.filter((c) => c.type === 'Sector');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CandidateNav initialName={profile.name} />

      <main className="max-w-5xl w-full mx-auto px-6 py-10 space-y-8 flex-1">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 mb-1">
              My profile
            </h1>
            <p className="text-sm text-neutral-500">
              Control how jobs and companies are matched to you.
            </p>
          </div>
          <Link href="/candidate" className="btn-pill-secondary text-xs px-4 py-2">
            Back home
          </Link>
        </div>

        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
            {error}
          </div>
        )}

        {saved && (
          <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl" role="status">
            Profile saved.
          </div>
        )}

        <form className="space-y-8" onSubmit={submit}>
          {/* Top Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <label htmlFor="candidate-name" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Name
              </label>
              <input
                id="candidate-name"
                name="name"
                defaultValue={profile.name}
                maxLength={120}
                required
                className="input-clean w-full"
              />
            </div>

            <div>
              <label htmlFor="candidate-email" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Email
              </label>
              <input
                id="candidate-email"
                value={profile.email}
                disabled
                className="input-clean w-full bg-neutral-50 text-neutral-400 cursor-not-allowed"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Email is managed by the admin because it is also your login identity.
              </p>
            </div>

            <div>
              <label htmlFor="candidate-expertise" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Expertise
              </label>
              <input
                id="candidate-expertise"
                name="expertise"
                defaultValue={profile.expertise ?? ''}
                placeholder="e.g. Backend Engineer, AI Engineer"
                maxLength={500}
                className="input-clean w-full"
              />
            </div>

            <div>
              <label htmlFor="candidate-skills" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Skills
              </label>
              <input
                id="candidate-skills"
                name="skills"
                defaultValue={profile.skills ?? ''}
                placeholder="Node.js, NestJS"
                maxLength={1000}
                className="input-clean w-full"
              />
            </div>

            <div>
              <label htmlFor="candidate-experience-level" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Experience level
              </label>
              <select
                id="candidate-experience-level"
                name="experienceLevel"
                defaultValue={profile.experience_level ?? ''}
                className="select-clean w-full"
              >
                <option value="">Not specified</option>
                {CONTROLLED_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="candidate-minimum-match-score" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Minimum match score
              </label>
              <input
                id="candidate-minimum-match-score"
                name="minimumMatchScore"
                type="number"
                min="0"
                max="100"
                defaultValue={profile.minimum_match_score}
                required
                className="input-clean w-full"
              />
            </div>

            <div>
              <label htmlFor="candidate-preferred-locations" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Preferred locations
              </label>
              <input
                id="candidate-preferred-locations"
                name="preferredLocations"
                defaultValue={profile.preferred_locations ?? ''}
                placeholder="Gulshan, Banani, Remote"
                maxLength={1000}
                className="input-clean w-full"
              />
            </div>

            <div>
              <label htmlFor="candidate-excluded-locations" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Excluded locations
              </label>
              <input
                id="candidate-excluded-locations"
                name="excludedLocations"
                defaultValue={profile.excluded_locations ?? ''}
                placeholder="Uttara, Savar"
                maxLength={1000}
                className="input-clean w-full"
              />
            </div>
          </div>

          {/* Preferred work modes */}
          <div className="space-y-2 pt-2 border-t border-neutral-100">
            <h2 className="text-sm font-bold text-neutral-900">Preferred work modes</h2>
            <div className="flex items-center gap-6 pt-1">
              {['Remote', 'Hybrid', 'On-site'].map((mode) => (
                <label key={mode} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800">
                  <input
                    name="workModes"
                    type="checkbox"
                    value={mode}
                    defaultChecked={workModes.has(mode)}
                    className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-4"
                  />
                  {mode}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-neutral-400">
              If a job explicitly states a different work mode, it is rejected. Unknown work mode is not rejected.
            </p>
          </div>

          {/* Category preferences */}
          <div className="space-y-6 pt-4 border-t border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900 mb-2">Category preferences</h2>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-4 py-3 text-xs text-neutral-600">
                Excluded sectors are hard filters. Excluded technologies/domains reject only jobs that explicitly match them. If a category is selected in both lists, exclusion wins.
              </div>
            </div>

            {/* TECHNOLOGY PREFERRED */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Technology · Preferred
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {techCategories.map((c) => (
                  <label key={`pref-tech-${c.name}`} className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer">
                    <input
                      name="preferredCategories"
                      type="checkbox"
                      value={c.name}
                      defaultChecked={preferred.has(c.name)}
                      className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-3.5"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* TECHNOLOGY EXCLUDED */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Technology · Excluded
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {techCategories.map((c) => (
                  <label key={`excl-tech-${c.name}`} className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer">
                    <input
                      name="excludedCategories"
                      type="checkbox"
                      value={c.name}
                      defaultChecked={excluded.has(c.name)}
                      className="rounded border-neutral-300 text-rose-600 focus:ring-rose-600 size-3.5"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* DOMAIN PREFERRED */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Domain · Preferred
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {domainCategories.map((c) => (
                  <label key={`pref-dom-${c.name}`} className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer">
                    <input
                      name="preferredCategories"
                      type="checkbox"
                      value={c.name}
                      defaultChecked={preferred.has(c.name)}
                      className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-3.5"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* DOMAIN EXCLUDED */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Domain · Excluded
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {domainCategories.map((c) => (
                  <label key={`excl-dom-${c.name}`} className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer">
                    <input
                      name="excludedCategories"
                      type="checkbox"
                      value={c.name}
                      defaultChecked={excluded.has(c.name)}
                      className="rounded border-neutral-300 text-rose-600 focus:ring-rose-600 size-3.5"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* SECTOR PREFERRED */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Sector · Preferred
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {sectorCategories.map((c) => (
                  <label key={`pref-sec-${c.name}`} className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer">
                    <input
                      name="preferredCategories"
                      type="checkbox"
                      value={c.name}
                      defaultChecked={preferred.has(c.name)}
                      className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-3.5"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* SECTOR EXCLUDED */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Sector · Excluded
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {sectorCategories.map((c) => (
                  <label key={`excl-sec-${c.name}`} className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer">
                    <input
                      name="excludedCategories"
                      type="checkbox"
                      value={c.name}
                      defaultChecked={excluded.has(c.name)}
                      className="rounded border-neutral-300 text-rose-600 focus:ring-rose-600 size-3.5"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-pill-primary px-6 py-2.5 text-sm"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <Link
              href="/candidate"
              className="btn-pill-secondary px-6 py-2.5 text-sm"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
