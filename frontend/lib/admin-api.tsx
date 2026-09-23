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
      <main className="min-h-screen flex items-center justify-center p-6 bg-neutral-50/50">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200/80 bg-white p-8">
          <p className="eyebrow">Administration</p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mt-1">Admin sign in</h1>
          <p className="text-xs text-neutral-500 mt-1 mb-6">
            Use your administrator account to manage company intelligence.
          </p>
          <form className="flex flex-col gap-4" onSubmit={signIn}>
            <div>
              <label htmlFor="admin-username" className="text-xs font-semibold text-neutral-600 mb-1">
                Username
              </label>
              <input
                id="admin-username"
                name="username"
                className="input-clean"
                autoComplete="username"
                placeholder="admin"
                required
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="text-xs font-semibold text-neutral-600 mb-1">
                Password
              </label>
              <input
                id="admin-password"
                name="password"
                type="password"
                className="input-clean"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p className="error text-xs font-medium text-rose-600 mt-1" role="alert">
                {error}
              </p>
            )}
            <button className="btn-pill-primary w-full mt-2" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    );

  return (
    <AdminContext.Provider value={request}>
      <div className="min-h-screen flex flex-col md:flex-row bg-white text-neutral-900 max-w-full overflow-x-hidden">
        {/* Left Sidebar matching Figma image 1 */}
        <aside className="w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-neutral-100 bg-white p-6 flex flex-col justify-between md:min-h-screen md:sticky md:top-0 md:self-start">
          <div>
            <div className="mb-8">
              <Link href="/admin" className="font-bold text-lg tracking-tight text-neutral-900 block">
                Job Intelligence
              </Link>
              <p className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase mt-0.5">
                OPERATIONS · DB NEON
              </p>
            </div>
            <nav aria-label="Administration" className="flex flex-wrap md:flex-col gap-2 md:gap-0 md:space-y-2.5 text-sm">
              <Link
                href="/admin"
                className="text-neutral-600 hover:text-black font-medium transition py-1 px-2 md:px-0"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/companies"
                className="text-neutral-600 hover:text-black font-medium transition py-1 px-2 md:px-0"
              >
                Companies
              </Link>
              <Link
                href="/admin/categories"
                className="text-neutral-600 hover:text-black font-medium transition py-1 px-2 md:px-0"
              >
                Categories
              </Link>
              <Link
                href="/admin/jobs"
                className="text-neutral-600 hover:text-black font-medium transition py-1 px-2 md:px-0"
              >
                Jobs
              </Link>
              <Link
                href="/admin/candidates"
                className="text-neutral-600 hover:text-black font-medium transition py-1 px-2 md:px-0"
              >
                Candidates
              </Link>
              <Link
                href="/admin/crawl-logs"
                className="text-neutral-600 hover:text-black font-medium transition py-1 px-2 md:px-0"
              >
                Crawler
              </Link>
              <Link
                href="/admin/settings"
                className="text-neutral-600 hover:text-black font-medium transition py-1 px-2 md:px-0"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="pt-6 mt-4 md:mt-0 border-t border-neutral-100">
            <button
              type="button"
              className="text-xs font-medium text-neutral-400 hover:text-neutral-900 transition flex items-center gap-1.5"
              onClick={() => {
                setAuthorization(null);
                setError('');
              }}
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 max-w-full p-4 md:p-8 lg:p-12 overflow-x-hidden">{children}</main>
      </div>
    </AdminContext.Provider>
  );
}

/** Admin screens receive a request helper, never the credential string itself. */
export function useAdminApi(): AdminRequest {
  const request = useContext(AdminContext);
  if (!request) throw new Error('Admin pages must be rendered inside AdminSession.');
  return request;
}
