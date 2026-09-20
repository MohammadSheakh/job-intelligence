'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
interface Candidate { id: string; name: string; email: string; mustChangePassword: boolean; }
export default function CandidateHomePage() {
  const router = useRouter(); const [candidate, setCandidate] = useState<Candidate | null>(null);
  useEffect(() => { api<Candidate>('/candidate-auth/me').then((value) => value.mustChangePassword ? router.replace('/candidate/change-password') : setCandidate(value)).catch(() => router.replace('/candidate/login')); }, [router]);
  if (!candidate) return <main className="auth"><p className="muted">Loading your candidate portal…</p></main>;
  return <main><header><div><p className="eyebrow">Candidate portal</p><h1>Welcome, {candidate.name}</h1><p className="muted">{candidate.email}</p></div><nav><Link href="/candidate/profile">Profile</Link><Link href="/candidate/companies">Companies</Link><Link href="/candidate/pipeline">Pipeline</Link></nav></header><section className="card"><h2>Your portal is ready</h2><p>Manage your matching profile, browse companies, and track applications. Recommendations and Quick Search will appear here when their matching API migration is complete.</p></section></main>;
}
