import { db } from '../db.js';
import type { CompanyForCrawl } from '../crawler/types.js';

export async function getCompaniesForDailyCrawl(limit?: number): Promise<CompanyForCrawl[]> {
  const params: unknown[] = [];
  let limitClause = '';

  if (limit && limit > 0) {
    params.push(limit);
    limitClause = `LIMIT $${params.length}`;
  }

  const result = await db.query<{
    id: string;
    name: string;
    career_url: string;
  }>(`
    SELECT id, name, career_url
    FROM companies
    WHERE active = true
      AND career_url IS NOT NULL
      AND btrim(career_url) <> ''
      AND recommended_action = 'MONITOR_READY'
    ORDER BY COALESCE(last_checked_at, '1970-01-01'::timestamptz) ASC, id ASC
    ${limitClause}
  `, params);

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    careerUrl: row.career_url,
  }));
}

export async function markCompanyChecked(companyId: string): Promise<void> {
  await db.query('UPDATE companies SET last_checked_at = now(), updated_at = now() WHERE id = $1', [companyId]);
}

export async function getCompaniesForQuickSearch(candidateId: number, preferredCategories: string | null | undefined, limit: number): Promise<CompanyForCrawl[]> {
  const categories = (preferredCategories ?? '').split(/[,;|\n]+/).map((x) => x.trim()).filter(Boolean);
  const result = await db.query<{ id:string; name:string; career_url:string }>(`
    SELECT c.id,c.name,c.career_url
    FROM companies c
    WHERE c.active=true
      AND c.career_url IS NOT NULL
      AND btrim(c.career_url)<>''
      AND c.recommended_action='MONITOR_READY'
    ORDER BY
      CASE WHEN cardinality($1::text[]) = 0 THEN 0 ELSE (
        SELECT count(*)
        FROM company_categories cc
        JOIN categories cat ON cat.id=cc.category_id
        WHERE cc.company_id=c.id AND cat.name=ANY($1::text[])
      ) END DESC,
      COALESCE(c.last_checked_at,'1970-01-01'::timestamptz) ASC,
      c.id ASC
    LIMIT $2
  `, [categories, Math.max(1, Math.min(25, limit))]);
  return result.rows.map((row) => ({ id:row.id, name:row.name, careerUrl:row.career_url }));
}
