'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAdminApi } from '../../lib/admin-api';

interface DashboardData {
  stats: {
    companies: number;
    monitorReady: number;
    jobs: number;
    openJobs: number;
    candidates: number;
    notifications: number;
    crawlFailures24h: number;
  };
  settings: {
    aiEnabled: boolean;
    aiMatchingEnabled: boolean;
    aiProvider: string;
    aiDailyLimit: number;
    aiSkillExtractionEnabled: boolean;
    defaultMatchThreshold: number;
    emailEnabled: boolean;
    quickSearchDailyLimit: number;
    quickSearchAiDailyLimit: number;
    quickSearchCompanyLimit: number;
  };
  recentCrawlLogs: Array<{
    id: string;
    companyName: string;
    checkedAt: string;
    success: boolean;
    jobsFound: number;
    error: string | null;
  }>;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AdminDashboardPage() {
  const api = useAdminApi();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    api<DashboardData>('/admin/dashboard', { signal: controller.signal })
      .then((res) => setData(res))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [api]);

  if (loading) {
    return (
      <div className="py-12">
        <p className="text-sm text-neutral-400">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12">
        <p className="text-sm text-rose-600" role="alert">
          {error || 'Dashboard unavailable.'}
        </p>
      </div>
    );
  }

  const { stats, settings, recentCrawlLogs } = data;

  return (
    <div className="max-w-6xl">
      {/* Header matching Figma image 1 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">Live Neon-backed MVP status</p>
      </div>

      {/* Unboxed KPI Metrics Row matching Figma image 1 */}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6 border-b border-neutral-100 pb-8 mb-10">
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase mb-1">
            Companies
          </p>
          <p className="text-4xl font-bold tracking-tight text-neutral-900">{stats.companies}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase mb-1">
            Monitor Ready
          </p>
          <p className="text-4xl font-bold tracking-tight text-neutral-900">{stats.monitorReady}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase mb-1">
            Open Jobs
          </p>
          <p className="text-4xl font-bold tracking-tight text-neutral-900">{stats.openJobs}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase mb-1">
            Active Candidates
          </p>
          <p className="text-4xl font-bold tracking-tight text-neutral-900">{stats.candidates}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase mb-1">
            Notifications Sent
          </p>
          <p className="text-4xl font-bold tracking-tight text-neutral-900">{stats.notifications}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase mb-1">
            Crawler Failures / 24h
          </p>
          <p
            className={`text-4xl font-bold tracking-tight ${
              stats.crawlFailures24h > 0 ? 'text-neutral-900' : 'text-neutral-900'
            }`}
          >
            {stats.crawlFailures24h}
          </p>
        </div>
      </div>

      {/* Controls Section matching Figma image 1 */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-neutral-900 mb-4">Controls</h2>
        <div className="grid gap-5 sm:grid-cols-2 max-w-4xl">
          {/* AI Control Card */}
          <div className="rounded-2xl border border-neutral-200/80 p-5 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-neutral-900">AI</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  settings.aiEnabled
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {settings.aiEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Matching: {settings.aiMatchingEnabled ? 'enabled' : 'disabled'} · daily limit{' '}
              {settings.aiDailyLimit}
            </p>
          </div>

          {/* Email Control Card */}
          <div className="rounded-2xl border border-neutral-200/80 p-5 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-neutral-900">Email</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  settings.emailEnabled
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {settings.emailEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Default match threshold {settings.defaultMatchThreshold}%
            </p>
          </div>
        </div>
      </div>

      {/* Recent Crawler Activity Table matching Figma image 1 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-neutral-900">Recent crawler activity</h2>
          <Link
            href="/admin/crawl-logs"
            className="text-xs font-medium text-neutral-500 hover:text-black transition"
          >
            View all logs →
          </Link>
        </div>
        <div className="w-full overflow-x-auto">
          {recentCrawlLogs.length === 0 ? (
            <p className="py-6 text-xs text-neutral-400">No crawler runs recorded yet.</p>
          ) : (
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Checked</th>
                  <th>Status</th>
                  <th>Jobs</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {recentCrawlLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-semibold text-neutral-900">{log.companyName}</td>
                    <td className="text-xs text-neutral-500 whitespace-nowrap">
                      {formatDate(log.checkedAt)}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium inline-flex items-center ${
                          log.success
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="text-sm text-neutral-800">{log.jobsFound}</td>
                    <td className="text-xs text-neutral-400">{log.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
