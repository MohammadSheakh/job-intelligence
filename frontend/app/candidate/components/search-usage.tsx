'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../../lib/api';

interface SearchUsage {
  used: number;
  dailyLimit: number;
  remaining: number;
  resetsAt: string;
}

/** Display the persisted allowance independently from recommendation loading. */
export function SearchUsage() {
  const router = useRouter();
  const [usage, setUsage] = useState<SearchUsage | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setUsage(null);
    setError('');
    api<SearchUsage>('/candidate/quick-search/usage', { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setUsage(value);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        const destination = candidateAuthRedirect(reason);
        if (destination) router.replace(destination);
        else
          setError(reason instanceof Error ? reason.message : 'Search usage could not be loaded.');
      });
    return () => controller.abort();
  }, [revision, router]);

  return (
    <section className="card" aria-labelledby="search-usage-heading">
      <h2 id="search-usage-heading">Quick Search</h2>
      <p>
        On-demand company checks are not available here yet. You can still browse your current
        recommendations below.
      </p>
      {usage && (
        <p>
          {usage.remaining} of {usage.dailyLimit} daily searches remaining. Resets at{' '}
          <time dateTime={usage.resetsAt}>
            {new Date(usage.resetsAt).toLocaleString('en-GB', {
              timeZone: 'Asia/Dhaka',
              hour: '2-digit',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
            })}
          </time>{' '}
          (Dhaka).
        </p>
      )}
      {!usage && !error && <p role="status">Loading search allowance…</p>}
      {error && (
        <div role="alert">
          <p className="error">{error}</p>
          <button className="secondary" onClick={() => setRevision((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
    </section>
  );
}
