'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../lib/api';
import { CandidateNav } from './components/candidate-nav';
import { Recommendations } from './components/recommendations';
import { SearchUsage } from './components/search-usage';

interface Candidate {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
}

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

interface PipelineItem {
  companyId: string;
  companyName: string;
  status: 'PLANNING' | 'APPLIED' | 'EXCLUDED';
}

interface SearchUsageData {
  used: number;
  dailyLimit: number;
  remaining: number;
  aiUsed: number;
  aiDailyLimit: number;
  aiRemaining: number;
  aiAvailable: boolean;
}

export default function CandidateHomePage() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pipelineStats, setPipelineStats] = useState({ planning: 0, applied: 0, blacklist: 0 });
  const [usage, setUsage] = useState<SearchUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    api<Candidate>('/candidate-auth/me', { signal: controller.signal })
      .then((me) => {
        if (me.mustChangePassword) {
          router.replace('/candidate/change-password');
          return;
        }
        setCandidate(me);

        // Fetch supporting dashboard data in parallel
        Promise.allSettled([
          api<Profile>('/candidate/profile', { signal: controller.signal }),
          api<PipelineItem[]>('/candidate/pipeline', { signal: controller.signal }),
          api<SearchUsageData>('/candidate/quick-search/usage', { signal: controller.signal }),
        ]).then(([profileRes, pipelineRes, usageRes]) => {
          if (controller.signal.aborted) return;

          if (profileRes.status === 'fulfilled') {
            setProfile(profileRes.value);
          }
          if (pipelineRes.status === 'fulfilled') {
            const items = pipelineRes.value;
            setPipelineStats({
              planning: items.filter((i) => i.status === 'PLANNING').length,
              applied: items.filter((i) => i.status === 'APPLIED').length,
              blacklist: items.filter((i) => i.status === 'EXCLUDED').length,
            });
          }
          if (usageRes.status === 'fulfilled') {
            setUsage(usageRes.value);
          }
          setLoading(false);
        });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          const destination = candidateAuthRedirect(err);
          router.replace(destination ?? '/candidate/login');
        }
      });

    return () => controller.abort();
  }, [router]);

  if (!candidate || loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <CandidateNav initialName={candidate?.name} />
        <main className="max-w-7xl mx-auto px-6 py-20 text-center">
          <p className="text-sm text-neutral-400">Loading your candidate portal…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CandidateNav initialName={candidate.name} />

      <main className="max-w-7xl w-full mx-auto px-6 py-10 space-y-12 flex-1">
        {/* Header */}
        <div>
          <p className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 mb-1">
            Candidate Dashboard
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-950 mb-1">
            {profile?.name || candidate.name}
          </h1>
          <p className="text-sm text-neutral-500">
            {profile?.expertise ? `${profile.expertise} · ` : ''}
            {profile?.email || candidate.email}
          </p>
        </div>

        {/* Unboxed KPI Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pb-8 border-b border-neutral-100">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 mb-1">
              Planning
            </p>
            <p className="text-4xl font-extrabold text-neutral-950 tracking-tight">
              {pipelineStats.planning}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 mb-1">
              Applied
            </p>
            <p className="text-4xl font-extrabold text-neutral-950 tracking-tight">
              {pipelineStats.applied}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 mb-1">
              Blacklist
            </p>
            <p className="text-4xl font-extrabold text-neutral-950 tracking-tight">
              {pipelineStats.blacklist}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 mb-1">
              Quick Searches Left
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-extrabold text-neutral-950 tracking-tight">
                {usage?.remaining ?? 3}
              </p>
              <span className="text-xs text-neutral-400">
                AI remaining {usage?.aiRemaining ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Recommendations */}
        <Recommendations />

        {/* Divider */}
        <div className="border-b border-neutral-100"></div>

        {/* Section 2: On-demand refresh */}
        <SearchUsage />

        {/* Divider */}
        <div className="border-b border-neutral-100"></div>

        {/* Section 3: Matching Profile */}
        <section aria-labelledby="matching-profile-heading" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 mb-0.5">
                Matching Profile
              </p>
              <h2 id="matching-profile-heading" className="text-xl font-bold tracking-tight text-neutral-950">
                Your preferences
              </h2>
            </div>
            <div className="flex items-center gap-2.5">
              <Link href="/candidate/companies" className="btn-pill-secondary text-xs px-4 py-1.5">
                Browse companies
              </Link>
              <Link href="/candidate/pipeline" className="btn-pill-secondary text-xs px-4 py-1.5">
                Open pipeline
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 pt-2 text-xs">
            <div className="flex justify-between py-2 border-b border-neutral-50">
              <span className="text-neutral-500">Skills</span>
              <span className="font-semibold text-neutral-900">{profile?.skills || 'Not specified'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-50">
              <span className="text-neutral-500">Locations</span>
              <span className="font-semibold text-neutral-900">{profile?.preferred_locations || 'Any'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-50">
              <span className="text-neutral-500">Preferred categories</span>
              <span className="font-semibold text-neutral-900">{profile?.preferred_categories || 'None'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-50">
              <span className="text-neutral-500">Excluded categories</span>
              <span className="font-semibold text-neutral-900">{profile?.excluded_categories || 'None'}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
