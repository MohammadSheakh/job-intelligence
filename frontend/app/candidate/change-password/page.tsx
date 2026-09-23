'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../../lib/api';

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
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      setError(reason instanceof Error ? reason.message : 'Password change failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200/80 p-8 shadow-sm space-y-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
            Job Intelligence · Candidate
          </span>
          <h1 className="text-2xl font-extrabold text-neutral-950 tracking-tight">Choose a new password</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Your administrator requires you to change the temporary password before continuing.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="input-clean w-full text-xs"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="input-clean w-full text-xs"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-pill-primary w-full py-2.5 text-xs font-semibold mt-2"
          >
            {loading ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </main>
  );
}
