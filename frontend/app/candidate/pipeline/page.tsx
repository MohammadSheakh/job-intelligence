'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

type PipelineItem = { companyId: string; companyName: string; status: 'PLANNING' | 'APPLIED' | 'EXCLUDED'; lastAppliedAt: string | null; reapplyCount: number; notes: string | null; categories: string[] };

export default function CandidatePipelinePage() {
  const router = useRouter();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { setItems(await api<PipelineItem[]>('/candidate/pipeline')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Pipeline could not be loaded.'); if (reason instanceof Error && /unauthor/i.test(reason.message)) router.replace('/candidate/login'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []); // Initial authenticated request.

  async function save(event: FormEvent<HTMLFormElement>, item: PipelineItem) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setSavingId(item.companyId); setError('');
    try {
      await api('/candidate/pipeline/company-state', { method: 'POST', body: JSON.stringify({ companyId: item.companyId, status: form.get('status'), lastAppliedAt: form.get('lastAppliedAt') || undefined, reapplyCount: Number(form.get('reapplyCount') ?? 0), notes: form.get('notes') || undefined }) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Pipeline item could not be saved.'); }
    finally { setSavingId(null); }
  }
  async function remove(companyId: string) {
    setSavingId(companyId); setError('');
    try { await api(`/candidate/pipeline/${companyId}`, { method: 'DELETE' }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Pipeline item could not be removed.'); }
    finally { setSavingId(null); }
  }

  return <main><header><div><p className="eyebrow">Candidate portal</p><h1>Application pipeline</h1><p className="muted">Track companies you plan to apply to, have applied to, or want to exclude.</p></div><nav><Link href="/candidate">Overview</Link><Link href="/candidate/profile">Profile</Link><Link href="/candidate/companies">Companies</Link></nav></header>
    {error && <p className="error" role="alert">{error}</p>}{loading ? <p className="muted">Loading your pipeline…</p> : <section className="results">{items.map((item) => <form className="card pipeline" key={item.companyId} onSubmit={(event) => save(event, item)}><div><h2>{item.companyName}</h2><p className="tags">{item.categories.join(' · ') || 'Uncategorized'}</p></div><label>Status<select name="status" defaultValue={item.status}><option value="PLANNING">Planning</option><option value="APPLIED">Applied</option><option value="EXCLUDED">Excluded</option></select></label><label>Last applied<input name="lastAppliedAt" type="date" defaultValue={item.lastAppliedAt ?? ''} /></label><label>Reapply count<input name="reapplyCount" type="number" min="0" defaultValue={item.reapplyCount} /></label><label>Notes<textarea name="notes" defaultValue={item.notes ?? ''} maxLength={5000} /></label><div><button disabled={savingId === item.companyId}>{savingId === item.companyId ? 'Saving…' : 'Save'}</button><button className="secondary" type="button" disabled={savingId === item.companyId} onClick={() => void remove(item.companyId)}>Remove</button></div></form>)}{items.length === 0 && <section className="card"><p className="muted">Your pipeline is empty. Add a company through the candidate API while company actions are being completed.</p></section>}</section>}
  </main>;
}
