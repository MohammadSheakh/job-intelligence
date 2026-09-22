'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAdminApi } from '../../../lib/admin-api';

interface SystemSettings {
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
}

export default function AdminSettingsPage() {
  const api = useAdminApi();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    api<SystemSettings>('/admin/settings', { signal: controller.signal })
      .then((data) => setSettings(data))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load system settings.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [api]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSuccess('Runtime settings updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof SystemSettings>(field: K, value: SystemSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  return (
    <>
      <div className="flex flex-col gap-1 mb-6">
        <h1>Operational Settings</h1>
        <p>Runtime controls for AI services, email dispatch, and candidate search limits.</p>
      </div>

      {success && (
        <p className="success mb-4" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="error mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <section className="card">
          <p className="muted">Loading settings…</p>
        </section>
      ) : settings ? (
        <form className="card mb-8" onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* AI Settings Section */}
            <div>
              <h2>AI Intelligence Controls</h2>
              <p className="text-xs text-slate-500 mb-3">
                Controls semantic job analysis, match scoring enhancements, and external LLM limits.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="aiEnabled"
                    className="size-4 m-0"
                    checked={settings.aiEnabled}
                    onChange={(e) => updateField('aiEnabled', e.target.checked)}
                  />
                  <label htmlFor="aiEnabled" className="m-0 text-sm font-medium text-slate-800">
                    Master AI Engine Enabled
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="aiMatchingEnabled"
                    className="size-4 m-0"
                    checked={settings.aiMatchingEnabled}
                    onChange={(e) => updateField('aiMatchingEnabled', e.target.checked)}
                  />
                  <label
                    htmlFor="aiMatchingEnabled"
                    className="m-0 text-sm font-medium text-slate-800"
                  >
                    AI Match Enhancement Enabled
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="aiSkillExtractionEnabled"
                    className="size-4 m-0"
                    checked={settings.aiSkillExtractionEnabled}
                    onChange={(e) => updateField('aiSkillExtractionEnabled', e.target.checked)}
                  />
                  <label
                    htmlFor="aiSkillExtractionEnabled"
                    className="m-0 text-sm font-medium text-slate-800"
                  >
                    AI Skill Extraction Enabled
                  </label>
                </div>
              </div>

              <div className="admin-fields gap-4 mt-4">
                <label>
                  AI Provider Identifier
                  <input
                    name="aiProvider"
                    value={settings.aiProvider}
                    onChange={(e) => updateField('aiProvider', e.target.value)}
                    placeholder="openai-compatible / local"
                    maxLength={100}
                  />
                </label>
                <label>
                  Daily AI Execution Budget (calls/day)
                  <input
                    type="number"
                    min={0}
                    name="aiDailyLimit"
                    value={settings.aiDailyLimit}
                    onChange={(e) => updateField('aiDailyLimit', Number(e.target.value))}
                  />
                </label>
              </div>
            </div>

            {/* Matching & Notifications Section */}
            <div className="border-t border-slate-200 pt-6">
              <h2>Matching & Email Delivery</h2>
              <p className="text-xs text-slate-500 mb-3">
                Scoring threshold defaults and SMTP email dispatch switches.
              </p>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="emailEnabled"
                  className="size-4 m-0"
                  checked={settings.emailEnabled}
                  onChange={(e) => updateField('emailEnabled', e.target.checked)}
                />
                <label htmlFor="emailEnabled" className="m-0 text-sm font-medium text-slate-800">
                  Candidate Email Digests Dispatch Enabled
                </label>
              </div>

              <div className="admin-fields gap-4">
                <label>
                  Default Match Score Threshold (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    name="defaultMatchThreshold"
                    value={settings.defaultMatchThreshold}
                    onChange={(e) => updateField('defaultMatchThreshold', Number(e.target.value))}
                  />
                </label>
              </div>
            </div>

            {/* Quick Search Quotas Section */}
            <div className="border-t border-slate-200 pt-6">
              <h2>Quick Search Allowances</h2>
              <p className="text-xs text-slate-500 mb-3">
                Daily execution limits per candidate and crawl sweep limits per run.
              </p>
              <div className="admin-fields gap-4">
                <label>
                  Standard Quick Searches / Candidate / Day
                  <input
                    type="number"
                    min={0}
                    max={20}
                    name="quickSearchDailyLimit"
                    value={settings.quickSearchDailyLimit}
                    onChange={(e) => updateField('quickSearchDailyLimit', Number(e.target.value))}
                  />
                </label>
                <label>
                  AI Quick Searches / Candidate / Day
                  <input
                    type="number"
                    min={0}
                    max={20}
                    name="quickSearchAiDailyLimit"
                    value={settings.quickSearchAiDailyLimit}
                    onChange={(e) => updateField('quickSearchAiDailyLimit', Number(e.target.value))}
                  />
                </label>
                <label>
                  Companies Inspected Per Search Run
                  <input
                    type="number"
                    min={1}
                    max={25}
                    name="quickSearchCompanyLimit"
                    value={settings.quickSearchCompanyLimit}
                    onChange={(e) => updateField('quickSearchCompanyLimit', Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button type="submit" disabled={saving} className="px-6">
              {saving ? 'Saving settings…' : 'Save Settings'}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
