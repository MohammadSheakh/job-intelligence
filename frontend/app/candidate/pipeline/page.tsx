'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, candidateAuthRedirect } from '../../../lib/api';
import { CandidateNav } from '../components/candidate-nav';

type PipelineItem = {
  companyId: string;
  companyName: string;
  status: 'PLANNING' | 'APPLIED' | 'EXCLUDED';
  lastAppliedAt: string | null;
  reapplyCount: number;
  notes: string | null;
  categories: string[];
};

export default function CandidatePipelinePage() {
  const router = useRouter();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await api<PipelineItem[]>('/candidate/pipeline'));
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      setError(reason instanceof Error ? reason.message : 'Pipeline could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>, item: PipelineItem) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingId(item.companyId);
    setError('');
    try {
      await api('/candidate/pipeline/company-state', {
        method: 'POST',
        body: JSON.stringify({
          companyId: item.companyId,
          status: form.get('status'),
          lastAppliedAt: form.get('lastAppliedAt') || undefined,
          reapplyCount: Number(form.get('reapplyCount') ?? 0),
          notes: form.get('notes') || undefined,
        }),
      });
      await load();
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      setError(reason instanceof Error ? reason.message : 'Pipeline item could not be saved.');
    } finally {
      setSavingId(null);
    }
  }
  async function remove(companyId: string) {
    setSavingId(companyId);
    setError('');
    try {
      await api(`/candidate/pipeline/${companyId}`, { method: 'DELETE' });
      await load();
    } catch (reason) {
      const destination = candidateAuthRedirect(reason);
      if (destination) router.replace(destination);
      setError(reason instanceof Error ? reason.message : 'Pipeline item could not be removed.');
    } finally {
      setSavingId(null);
    }
  }

  const [statusTab, setStatusTab] = useState<'ALL' | 'PLANNING' | 'APPLIED' | 'EXCLUDED'>('ALL');

  const filteredItems = items.filter((item) => {
    if (statusTab === 'ALL') return true;
    return item.status === statusTab;
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CandidateNav />

      <main className="max-w-7xl w-full mx-auto px-6 py-10 space-y-8 flex-1">
        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950">
            My company pipeline
          </h1>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'PLANNING', label: 'Planning' },
                { id: 'APPLIED', label: 'Applied' },
                { id: 'EXCLUDED', label: 'Blacklist' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={`text-xs px-4 py-1.5 rounded-full transition font-medium ${
                  statusTab === tab.id
                    ? 'bg-neutral-950 text-white'
                    : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notice banner */}
        <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-4 py-3 text-xs text-neutral-600">
          For APPLIED companies, Latest apply date records your most recent application. Re-apply count is the number of applications after the first one.
        </div>

        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-neutral-400">Loading your pipeline…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean w-full">
              <thead>
                <tr>
                  <th>COMPANY</th>
                  <th>STATUS</th>
                  <th>LATEST APPLY / REAPPLY / NOTES</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isSaving = savingId === item.companyId;

                  return (
                    <tr key={item.companyId} className="align-top">
                      <td className="w-56 pr-4">
                        <h3 className="font-bold text-neutral-900 block text-sm">{item.companyName}</h3>
                        {item.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.categories.map((c) => (
                              <span key={c} className="tag-pill text-[10px]">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="w-32 pr-4">
                        {item.status === 'PLANNING' ? (
                          <span className="badge-warning text-xs">Planning</span>
                        ) : item.status === 'APPLIED' ? (
                          <span className="badge-success text-xs">Applied</span>
                        ) : (
                          <span className="badge-danger text-xs">Blacklist</span>
                        )}
                      </td>

                      <td>
                        <form
                          onSubmit={(event) => save(event, item)}
                          className="space-y-2.5 max-w-xl"
                        >
                          <div className="flex items-center gap-3">
                            <select
                              name="status"
                              defaultValue={item.status}
                              aria-label="Pipeline status"
                              className="select-clean text-xs flex-1"
                            >
                              <option value="PLANNING">PLANNING</option>
                              <option value="APPLIED">APPLIED</option>
                              <option value="EXCLUDED">BLACKLIST</option>
                            </select>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void remove(item.companyId)}
                              className="btn-pill-secondary text-xs px-3.5 py-1.5 flex-shrink-0"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <input
                              name="lastAppliedAt"
                              type="date"
                              defaultValue={item.lastAppliedAt ?? ''}
                              className="input-clean text-xs flex-1"
                              placeholder="Latest apply date"
                            />
                            <input
                              name="reapplyCount"
                              type="number"
                              min="0"
                              defaultValue={item.reapplyCount}
                              className="input-clean text-xs w-24"
                              placeholder="Reapply #"
                            />
                          </div>

                          <div>
                            <label htmlFor={`notes-${item.companyId}`} className="sr-only">
                              Notes
                            </label>
                            <input
                              id={`notes-${item.companyId}`}
                              name="notes"
                              aria-label="Notes"
                              defaultValue={item.notes ?? ''}
                              maxLength={5000}
                              placeholder="Add notes…"
                              className="input-clean text-xs w-full"
                            />
                          </div>

                          <div className="pt-1">
                            <button
                              type="submit"
                              disabled={isSaving}
                              className="btn-pill-primary text-xs px-5 py-1.5"
                            >
                              {isSaving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-sm text-neutral-400">
                      No companies in this pipeline category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
