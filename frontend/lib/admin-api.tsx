'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { api, ApiError } from './api';

type AdminRequest = <T>(path: string, options?: RequestInit) => Promise<T>;
const AdminContext = createContext<AdminRequest | null>(null);

/** Keep Basic credentials in memory only; refreshing or signing out requires a new sign-in. */
export function AdminSession({ children }: { children: ReactNode }) {
  const [authorization, setAuthorization] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const request = useCallback<AdminRequest>(
    async (path, options = {}) => {
      if (!authorization) throw new Error('Administrator sign-in is required.');
      try {
        return await api(path, { ...options, headers: { ...options.headers, authorization } });
      } catch (reason) {
        if (reason instanceof ApiError && reason.status === 401) {
          setAuthorization(null);
          setError('Your administrator credentials were rejected. Sign in again.');
        }
        throw reason;
      }
    },
    [authorization],
  );

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bytes = new TextEncoder().encode(`${form.get('username')}:${form.get('password')}`);
    const header = `Basic ${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))}`;
    setBusy(true);
    setError('');
    try {
      await api('/admin/companies?pageSize=1', { headers: { authorization: header } });
      setAuthorization(header);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!authorization)
    return (
      <main className="admin auth">
        <p className="eyebrow">Administration</p>
        <h1>Admin sign in</h1>
        <p>Use your administrator account to manage company intelligence.</p>
        <form className="card" onSubmit={signIn}>
          <label>
            Username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </main>
    );

  return (
    <AdminContext.Provider value={request}>
      <main className="admin">
        <header>
          <p className="eyebrow">Job Intelligence · Administration</p>
          <nav aria-label="Administration">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/companies">Companies</Link>
            <Link href="/admin/categories">Categories</Link>
            <Link href="/admin/jobs">Jobs</Link>
            <Link href="/admin/candidates">Candidates</Link>
            <Link href="/admin/crawl-logs">Crawler</Link>
            <Link href="/admin/settings">Settings</Link>
            <button
              className="secondary"
              onClick={() => {
                setAuthorization(null);
                setError('');
              }}
            >
              Sign out
            </button>
          </nav>
        </header>
        {children}
      </main>
    </AdminContext.Provider>
  );
}

/** Admin screens receive a request helper, never the credential string itself. */
export function useAdminApi(): AdminRequest {
  const request = useContext(AdminContext);
  if (!request) throw new Error('Admin pages must be rendered inside AdminSession.');
  return request;
}
