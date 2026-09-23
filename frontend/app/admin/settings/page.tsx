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
    <section className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 mb-1">Settings</h1>
        <p className="text-sm text-neutral-500">Cost and notification controls</p>
      </div>

      <div className="border-b border-neutral-100 pb-2"></div>

      {success && (
        <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl" role="status">
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-neutral-400">Loading settings…</div>
      ) : settings ? (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {/* Left Column */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="aiEnabled"
                  className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-4"
                  checked={settings.aiEnabled}
                  onChange={(e) => updateField('aiEnabled', e.target.checked)}
                />
                <span className="text-sm font-medium text-neutral-900">AI enabled</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="aiProvider">
                  AI provider
                </label>
                <input
                  id="aiProvider"
                  name="aiProvider"
                  value={settings.aiProvider}
                  onChange={(e) => updateField('aiProvider', e.target.value)}
                  placeholder="local / openai-compatible"
                  maxLength={100}
                  className="input-clean w-full"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="aiSkillExtractionEnabled"
                  className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-4"
                  checked={settings.aiSkillExtractionEnabled}
                  onChange={(e) => updateField('aiSkillExtractionEnabled', e.target.checked)}
                />
                <span className="text-sm font-medium text-neutral-900">AI skill extraction enabled</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="emailEnabled"
                  className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-4"
                  checked={settings.emailEnabled}
                  onChange={(e) => updateField('emailEnabled', e.target.checked)}
                />
                <span className="text-sm font-medium text-neutral-900">Email sending enabled</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="quickSearchAiDailyLimit">
                  AI quick searches / candidate / day
                </label>
                <input
                  id="quickSearchAiDailyLimit"
                  type="number"
                  min={0}
                  max={20}
                  name="quickSearchAiDailyLimit"
                  value={settings.quickSearchAiDailyLimit}
                  onChange={(e) => updateField('quickSearchAiDailyLimit', Number(e.target.value))}
                  className="input-clean w-full"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="aiMatchingEnabled"
                  className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 size-4"
                  checked={settings.aiMatchingEnabled}
                  onChange={(e) => updateField('aiMatchingEnabled', e.target.checked)}
                />
                <span className="text-sm font-medium text-neutral-900">AI matching enabled</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="aiDailyLimit">
                  Daily AI call limit
                </label>
                <input
                  id="aiDailyLimit"
                  type="number"
                  min={0}
                  name="aiDailyLimit"
                  value={settings.aiDailyLimit}
                  onChange={(e) => updateField('aiDailyLimit', Number(e.target.value))}
                  className="input-clean w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="defaultMatchThreshold">
                  Default match threshold
                </label>
                <input
                  id="defaultMatchThreshold"
                  type="number"
                  min={0}
                  max={100}
                  name="defaultMatchThreshold"
                  value={settings.defaultMatchThreshold}
                  onChange={(e) => updateField('defaultMatchThreshold', Number(e.target.value))}
                  className="input-clean w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="quickSearchDailyLimit">
                  Quick searches / candidate / day
                </label>
                <input
                  id="quickSearchDailyLimit"
                  type="number"
                  min={0}
                  max={20}
                  name="quickSearchDailyLimit"
                  value={settings.quickSearchDailyLimit}
                  onChange={(e) => updateField('quickSearchDailyLimit', Number(e.target.value))}
                  className="input-clean w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5" htmlFor="quickSearchCompanyLimit">
                  Companies checked per quick search
                </label>
                <input
                  id="quickSearchCompanyLimit"
                  type="number"
                  min={1}
                  max={25}
                  name="quickSearchCompanyLimit"
                  value={settings.quickSearchCompanyLimit}
                  onChange={(e) => updateField('quickSearchCompanyLimit', Number(e.target.value))}
                  className="input-clean w-full"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="btn-pill-primary px-8 py-2.5 text-sm"
            >
              {saving ? 'Saving settings…' : 'Save settings'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
