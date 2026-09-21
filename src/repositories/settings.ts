import { db } from '../db.js';

export interface SystemSettings {
  aiEnabled: boolean;
  aiProvider: string;
  aiDailyLimit: number;
  aiMatchingEnabled: boolean;
  aiSkillExtractionEnabled: boolean;
  defaultMatchThreshold: number;
  emailEnabled: boolean;
  quickSearchDailyLimit: number;
  quickSearchAiDailyLimit: number;
  quickSearchCompanyLimit: number;
}

export async function getSettings(): Promise<SystemSettings> {
  const result = await db.query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = new Map(result.rows.map((row) => [row.key, row.value]));
  const bool = (key: string, fallback = false) =>
    (map.get(key) ?? String(fallback)).toLowerCase() === 'true';
  const num = (key: string, fallback: number) => {
    const value = Number(map.get(key));
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    aiEnabled: bool('ai_enabled'),
    aiProvider: map.get('ai_provider') ?? '',
    aiDailyLimit: num('ai_daily_limit', 0),
    aiMatchingEnabled: bool('ai_matching_enabled'),
    aiSkillExtractionEnabled: bool('ai_skill_extraction_enabled'),
    defaultMatchThreshold: num('default_match_threshold', 70),
    emailEnabled: bool('email_enabled'),
    quickSearchDailyLimit: Math.max(0, num('quick_search_daily_limit', 3)),
    quickSearchAiDailyLimit: Math.max(0, num('quick_search_ai_daily_limit', 1)),
    quickSearchCompanyLimit: Math.max(1, num('quick_search_company_limit', 8)),
  };
}

const EDITABLE_SETTINGS = new Set([
  'ai_enabled',
  'ai_provider',
  'ai_daily_limit',
  'ai_matching_enabled',
  'ai_skill_extraction_enabled',
  'default_match_threshold',
  'email_enabled',
  'quick_search_daily_limit',
  'quick_search_ai_daily_limit',
  'quick_search_company_limit',
]);

export async function setSetting(key: string, value: string): Promise<void> {
  if (!EDITABLE_SETTINGS.has(key)) throw new Error(`Unsupported setting: ${key}`);
  await db.query(
    `
    INSERT INTO settings(key, value, updated_at)
    VALUES ($1, $2, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `,
    [key, value],
  );
}
