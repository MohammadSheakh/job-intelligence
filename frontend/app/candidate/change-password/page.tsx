'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api('/candidate-auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      router.replace('/candidate');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Password change failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <section className="card">
        <p className="eyebrow">Candidate portal</p>
        <h1>Choose a new password</h1>
        <p className="muted">
          Your administrator requires you to change the temporary password before continuing.
        </p>
        <form onSubmit={submit}>
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={loading}>{loading ? 'Saving…' : 'Save password'}</button>
        </form>
      </section>
    </main>
  );
}
