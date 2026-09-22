'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../../lib/api';

type Profile = {
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
};

const modes = ['Remote', 'Hybrid', 'On-site'];
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
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api<Profile>('/candidate/profile'),
      api<Array<{ name: string }>>('/candidate/categories'),
    ])
      .then(([candidate, catalog]) => {
        setProfile(candidate);
        setCategories(catalog.map((category) => category.name));
      })
      .catch((reason) => {
        const destination = candidateAuthRedirect(reason);
        if (destination) router.replace(destination);
        else setError(reason instanceof Error ? reason.message : 'Profile could not be loaded.');
      });
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
      setError(reason instanceof Error ? reason.message : 'Profile could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (!profile)
    return (
      <main className="auth">
        <p className={error ? 'error' : 'muted'} role={error ? 'alert' : undefined}>
          {error || 'Loading your profile…'}
        </p>
      </main>
    );
  const preferred = new Set(split(profile.preferred_categories));
  const excluded = new Set(split(profile.excluded_categories));
  const workModes = new Set(split(profile.preferred_work_modes));
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Candidate portal</p>
          <h1>Your profile</h1>
          <p className="muted">Keep these preferences current to improve your job matches.</p>
        </div>
        <nav>
          <Link href="/candidate">Overview</Link>
          <Link href="/candidate/companies">Companies</Link>
          <Link href="/candidate/pipeline">Pipeline</Link>
        </nav>
      </header>
      <form className="card form-grid" onSubmit={submit}>
        <label>
          Name
          <input name="name" defaultValue={profile.name} maxLength={120} required />
        </label>
        <label>
          Email
          <input value={profile.email} disabled />
        </label>
        <label>
          Expertise
          <textarea name="expertise" defaultValue={profile.expertise ?? ''} maxLength={500} />
        </label>
        <label>
          Skills
          <textarea name="skills" defaultValue={profile.skills ?? ''} maxLength={1000} />
        </label>
        <div className="grid gap-x-5 sm:grid-cols-2">
          <label>
            Experience level
            <select name="experienceLevel" defaultValue={profile.experience_level ?? ''}>
              <option value="">Select level…</option>
              {[
                'Student/Intern',
                'Fresher/Entry',
                'Junior',
                'Mid',
                'Senior',
                'Lead/Principal',
                'Manager',
              ].map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
              {profile.experience_level &&
                ![
                  'Student/Intern',
                  'Fresher/Entry',
                  'Junior',
                  'Mid',
                  'Senior',
                  'Lead/Principal',
                  'Manager',
                ].includes(profile.experience_level) && (
                  <option value={profile.experience_level}>
                    {profile.experience_level} (custom)
                  </option>
                )}
            </select>
          </label>
          <label>
            Years of experience
            <input
              name="experienceYears"
              type="number"
              min="0"
              max="70"
              defaultValue={profile.experience_years ?? ''}
              placeholder="e.g. 3"
            />
          </label>
        </div>
        <label>
          Preferred locations
          <input
            name="preferredLocations"
            defaultValue={profile.preferred_locations ?? ''}
            maxLength={1000}
          />
        </label>
        <label>
          Excluded locations
          <input
            name="excludedLocations"
            defaultValue={profile.excluded_locations ?? ''}
            maxLength={1000}
          />
        </label>
        <label>
          Minimum match score
          <input
            name="minimumMatchScore"
            type="number"
            min="0"
            max="100"
            defaultValue={profile.minimum_match_score}
            required
          />
        </label>
        <fieldset>
          <legend>Preferred work modes</legend>
          {modes.map((mode) => (
            <label className="check" key={mode}>
              <input
                name="workModes"
                type="checkbox"
                value={mode}
                defaultChecked={workModes.has(mode)}
              />
              {mode}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Preferred categories</legend>
          <div className="check-list">
            {categories.map((category) => (
              <label className="check" key={category}>
                <input
                  name="preferredCategories"
                  type="checkbox"
                  value={category}
                  defaultChecked={preferred.has(category)}
                />
                {category}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Excluded categories</legend>
          <div className="check-list">
            {categories.map((category) => (
              <label className="check" key={category}>
                <input
                  name="excludedCategories"
                  type="checkbox"
                  value={category}
                  defaultChecked={excluded.has(category)}
                />
                {category}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="success" role="status">
            Profile saved.
          </p>
        )}
        <button disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
    </main>
  );
}
