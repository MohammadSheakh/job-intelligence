import { db } from '../db.js';
import type { EnrichmentCompany } from '../categories/enrichment.js';

export async function listOtherCompanies(limit?: number): Promise<EnrichmentCompany[]> {
  const params: unknown[] = [];
  const limitSql =
    typeof limit === 'number' && limit > 0 ? (params.push(limit), `LIMIT $${params.length}`) : '';
  const result = await db.query<{
    id: string;
    name: string;
    website_url: string | null;
    career_url: string | null;
    tech_stack: string | null;
    notes: string | null;
    status_research_hint: string | null;
  }>(
    `
    SELECT DISTINCT c.id,c.name,c.website_url,c.career_url,c.tech_stack,c.notes,c.status_research_hint
    FROM companies c
    JOIN company_categories cc ON cc.company_id=c.id
    JOIN categories cat ON cat.id=cc.category_id
    WHERE cat.name='Other'
    ORDER BY c.id
    ${limitSql}
  `,
    params,
  );
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    websiteUrl: r.website_url,
    careerUrl: r.career_url,
    techStack: r.tech_stack,
    notes: r.notes,
    statusResearchHint: r.status_research_hint,
  }));
}

export async function ensureCategories(names: string[]): Promise<void> {
  if (!names.length) return;
  // New names default to 'other'; known names should already exist with their intended type.
  await db.query(
    `
    INSERT INTO categories(name,type)
    SELECT x,'other' FROM unnest($1::text[]) x
    ON CONFLICT(name) DO NOTHING
  `,
    [names],
  );
}

export async function addCompanyCategories(
  companyId: string,
  names: string[],
  source: string,
): Promise<void> {
  if (!names.length) return;
  await db.query(
    `
    INSERT INTO company_categories(company_id,category_id,source)
    SELECT $1,c.id,$3 FROM categories c WHERE c.name = ANY($2::text[])
    ON CONFLICT(company_id,category_id) DO UPDATE SET source=EXCLUDED.source
  `,
    [companyId, names, source],
  );
}
