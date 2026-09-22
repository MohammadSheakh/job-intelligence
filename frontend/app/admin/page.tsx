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
      <section className="card">
        <p className="muted">Loading dashboard…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="card">
        <p className="error" role="alert">
          {error || 'Dashboard unavailable.'}
        </p>
      </section>
    );
  }

  const { stats, settings, recentCrawlLogs } = data;

  return (
    <>
      <div className="flex flex-col gap-1 mb-6">
        <h1>Dashboard</h1>
        <p>Live operational status, system metrics, and crawler activity.</p>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-8">
        <div className="card">
          <p className="eyebrow">Companies</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.companies}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Monitor Ready</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.monitorReady}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Open Jobs</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.openJobs}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Candidates</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.candidates}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Notifications</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.notifications}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Crawl Fails (24h)</p>
          <p
            className={`mt-2 text-2xl font-bold ${stats.crawlFailures24h > 0 ? 'text-red-700' : 'text-slate-900'}`}
          >
            {stats.crawlFailures24h}
          </p>
        </div>
      </div>

      {/* Operational Controls Summary */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2>Operational Controls</h2>
          <Link href="/admin/settings" className="text-sm font-semibold">
            Edit settings →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">AI Intelligence</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${settings.aiEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
              >
                {settings.aiEnabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Matching: {settings.aiMatchingEnabled ? 'Active' : 'Disabled'} · Daily Limit:{' '}
              {settings.aiDailyLimit} calls
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Email Delivery</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${settings.emailEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
              >
                {settings.emailEnabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Default match threshold: {settings.defaultMatchThreshold}%
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Quick Search Quota</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                {settings.quickSearchCompanyLimit} cos/run
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Standard: {settings.quickSearchDailyLimit}/day · AI:{' '}
              {settings.quickSearchAiDailyLimit}/day
            </p>
          </div>
        </div>
      </div>

      {/* Recent Crawler Activity */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2>Recent Crawler Activity</h2>
          <Link href="/admin/crawl-logs" className="text-sm font-semibold">
            View all logs →
          </Link>
        </div>
        <div className="admin-table-wrap card p-0 overflow-hidden">
          {recentCrawlLogs.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No crawler runs recorded yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Checked</th>
                  <th>Status</th>
                  <th>Jobs Found</th>
                  <th>Diagnostic</th>
                </tr>
              </thead>
              <tbody>
                {recentCrawlLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <strong>{log.companyName}</strong>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(log.checkedAt)}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${log.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td>{log.jobsFound}</td>
                    <td className="text-xs text-slate-600">{log.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
