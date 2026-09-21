'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../lib/api';
import { Recommendations } from './components/recommendations';
interface Candidate {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
}
export default function CandidateHomePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  useEffect(() => {
    api<Candidate>('/candidate-auth/me')
      .then((value) =>
        value.mustChangePassword
          ? router.replace('/candidate/change-password')
          : setCandidate(value),
      )
      .catch(() => router.replace('/candidate/login'));
  }, [router]);
  async function logout() {
    setSigningOut(true);
    setError('');
    try {
      await api('/candidate-auth/logout', { method: 'POST' });
      router.replace('/candidate/login');
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      setError(reason instanceof Error ? reason.message : 'Sign out failed.');
    } finally {
      setSigningOut(false);
    }
  }
  if (!candidate)
    return (
      <main className="auth">
        <p className="muted">Loading your candidate portal…</p>
      </main>
    );
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Candidate portal</p>
          <h1>Welcome, {candidate.name}</h1>
          <p className="muted">{candidate.email}</p>
        </div>
        <nav>
          <Link href="/candidate/profile">Profile</Link>
          <Link href="/candidate/companies">Companies</Link>
          <Link href="/candidate/pipeline">Pipeline</Link>
          <button className="secondary" onClick={() => void logout()} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </nav>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Recommendations />
    </main>
  );
}
