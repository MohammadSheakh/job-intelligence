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
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Candidates</h1>
          <p>Directory of registered candidates, match criteria, and credentials.</p>
        </div>
        <div>
          <Link
            href="/admin/candidates/new"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800"
          >
            + Add Candidate
          </Link>
        </div>
      </div>

      <div className="admin-filters">
        <label className="compact-label sm:col-span-2">
          Search candidates
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, email, or skills…"
          />
        </label>
        <label className="compact-label">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">All statuses ({candidates.length})</option>
            <option value="active">
              Active only ({candidates.filter((c) => c.active).length})
            </option>
            <option value="inactive">
              Inactive only ({candidates.filter((c) => !c.active).length})
            </option>
          </select>
        </label>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="muted">Loading candidate directory…</p>
      ) : filteredCandidates.length === 0 ? (
        <div className="card">
          <p className="muted">No candidates found matching the selected criteria.</p>
        </div>
      ) : (
        <div className="admin-table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Experience</th>
                <th>Expertise &amp; Skills</th>
                <th>Categories</th>
                <th>Auth</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((candidate) => {
                const experienceSummary = [
                  candidate.experienceLevel,
                  candidate.experienceYears != null
                    ? `${candidate.experienceYears} yr${candidate.experienceYears === 1 ? '' : 's'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <tr key={candidate.id}>
                    <td>
                      <Link href={`/admin/candidates/${encodeURIComponent(candidate.id)}`}>
                        <strong>{candidate.name}</strong>
                      </Link>
                      <p className="muted">{candidate.email}</p>
                      <p className="muted font-mono text-[11px]">#{candidate.id}</p>
                    </td>
                    <td>
                      {experienceSummary ? (
                        <span className="status">{experienceSummary}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {candidate.expertise && <strong>{candidate.expertise}</strong>}
                      {candidate.skills && (
                        <p className="muted">
                          {candidate.skills.length > 80
                            ? `${candidate.skills.slice(0, 80)}…`
                            : candidate.skills}
                        </p>
                      )}
                    </td>
                    <td>
                      <p className="text-xs">
                        <strong>Preferred:</strong> {candidate.preferredCategories || 'None'}
                      </p>
                      {candidate.excludedCategories && (
                        <p className="text-xs text-red-700">
                          <strong>Excluded:</strong> {candidate.excludedCategories}
                        </p>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 text-xs">
                        {candidate.hasPassword && <span>🔑 Password</span>}
                        {candidate.hasGoogle && <span>🌐 Google</span>}
                        {!candidate.hasPassword && !candidate.hasGoogle && (
                          <span className="text-amber-700">No login</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status ${
                          candidate.active
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {candidate.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/admin/candidates/${encodeURIComponent(candidate.id)}`}
                        className="inline-flex items-center justify-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-200"
                      >
                        Edit ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
