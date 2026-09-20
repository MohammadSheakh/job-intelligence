'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
export default function CandidateLoginPage() {
  const router = useRouter(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(''); const form = new FormData(event.currentTarget); try { const result = await api<{ mustChangePassword: boolean }>('/candidate-auth/login', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) }); router.push(result.mustChangePassword ? '/candidate/change-password' : '/candidate'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Login failed.'); } finally { setLoading(false); } }
  return <main className="auth"><section className="card"><p className="eyebrow">Job Intelligence · Candidate</p><h1>Sign in</h1><p className="muted">Use the email your admin added to Job Intelligence.</p><form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="error">{error}</p>}<button disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button></form></section></main>;
}
