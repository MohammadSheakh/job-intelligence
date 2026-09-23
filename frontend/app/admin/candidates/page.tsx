'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAdminApi } from '../../../lib/admin-api';
import type { CandidateAdminRecord } from '../../../lib/candidate-admin';

export default function AdminCandidatesPage() {
  const api = useAdminApi();
  const [candidates, setCandidates] = useState<CandidateAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const list = await api<CandidateAdminRecord[]>('/admin/candidates', { signal });
        setCandidates(list);
      } catch (reason) {
        if (!signal?.aborted) {
          setError(reason instanceof Error ? reason.message : 'Failed to load candidates.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const filteredCandidates = candidates.filter((candidate) => {
    if (statusFilter === 'active' && !candidate.active) return false;
    if (statusFilter === 'inactive' && candidate.active) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = candidate.name.toLowerCase().includes(q);
      const matchEmail = candidate.email.toLowerCase().includes(q);
      const matchExpertise = candidate.expertise?.toLowerCase().includes(q) ?? false;
      const matchSkills = candidate.skills?.toLowerCase().includes(q) ?? false;
      return matchName || matchEmail || matchExpertise || matchSkills;
    }
    return true;
  });

  return (
    <div className="max-w-6xl">
      {/* Header matching Figma image 9 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Candidates</h1>
          <p className="text-sm text-neutral-500 mt-1">Profiles used by the matching engine</p>
        </div>
        <Link href="/admin/candidates/new" className="btn-pill-primary">
          + Add Candidate
        </Link>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-end gap-3 mb-8">
        <div className="w-full sm:w-80">
          <label className="text-xs font-semibold text-neutral-500 mb-1">Search</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, email, or skills…"
            className="input-clean"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="text-xs font-semibold text-neutral-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="select-clean"
          >
            <option value="all">All statuses ({candidates.length})</option>
            <option value="active">Active ({candidates.filter((c) => c.active).length})</option>
            <option value="inactive">Inactive ({candidates.filter((c) => !c.active).length})</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 mb-6" role="alert">
          <p className="text-sm font-medium text-rose-700">{error}</p>
        </div>
      )}

      {loading && <p className="py-8 text-sm text-neutral-400">Loading candidates…</p>}

      {!loading && !error && (
        <>
          {filteredCandidates.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400 border border-neutral-100 rounded-2xl">
              No candidates found matching the criteria.
            </div>
          ) : (
            <div className="w-full overflow-x-auto mb-6">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Expertise</th>
                    <th>Experience</th>
                    <th>Threshold</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-neutral-50/50 transition">
                      <td>
                        <Link
                          href={`/admin/candidates/${encodeURIComponent(candidate.id)}`}
                          className="font-bold text-neutral-900 hover:underline block"
                        >
                          {candidate.name}
                        </Link>
                        <span className="text-xs text-neutral-500">{candidate.email}</span>
                      </td>
                      <td className="text-sm text-neutral-800">
                        {candidate.expertise || '—'}
                        {candidate.skills && (
                          <div className="text-xs text-neutral-400 mt-0.5 line-clamp-1">
                            {candidate.skills}
                          </div>
                        )}
                      </td>
                      <td className="text-xs text-neutral-600 whitespace-nowrap">
                        <span className="badge-neutral">{candidate.experienceLevel || 'Not set'}</span>
                        {candidate.experienceYears != null && (
                          <span className="ml-1.5 text-neutral-500">
                            ({candidate.experienceYears}y)
                          </span>
                        )}
                      </td>
                      <td className="text-sm font-mono text-neutral-700 whitespace-nowrap">
                        {candidate.minimumMatchScore}%
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={candidate.active ? 'badge-success' : 'badge-neutral'}>
                          {candidate.active ? 'Active' : 'Inactive'}
                        </span>
                        {candidate.hasPassword ? (
                          <span className="badge-neutral ml-1.5 text-[10px]">Password</span>
                        ) : null}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <Link
                          href={`/admin/candidates/${encodeURIComponent(candidate.id)}`}
                          className="text-xs font-semibold text-neutral-900 hover:underline"
                        >
                          Edit →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
