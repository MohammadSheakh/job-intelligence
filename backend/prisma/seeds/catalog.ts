import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import type { Prisma } from '@prisma/client';

const root = resolve(__dirname, '../../..');

/** Read source artifacts only; fail before connecting if any seed relationship is invalid. */
export function loadCatalog() {
  const csv = readFileSync(resolve(root, 'data/clean_company_candidates.csv'), 'utf8');
  const sql = readFileSync(resolve(root, 'sql/004_categories_and_assignments.sql'), 'utf8');
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Record<
    string,
    string
  >[];
  if (!rows.length || rows.length > 10000)
    throw new Error('Company seed must contain 1–10000 rows.');
  const ids = new Set<string>();
  const text = (row: Record<string, string>, key: string) => row[key]?.trim() || null;
  const boolean = (row: Record<string, string>, key: string) => {
    const value = row[key]?.trim().toLowerCase();
    if (!['yes', 'no', 'true', 'false', '1', '0'].includes(value))
      throw new Error(`Invalid ${key} in company seed.`);
    return ['yes', 'true', '1'].includes(value);
  };
  const companies: Prisma.CompanyCreateManyInput[] = rows.map((row) => {
    const id = text(row, 'Company ID');
    const name = text(row, 'Company Name');
    if (!id || !name || ids.has(id)) throw new Error('Missing or duplicate company identity.');
    ids.add(id);
    const count = Number(row['Source Row Count']);
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid source row count.');
    const employeeCount = text(row, 'Employee Count Hint');
    if (employeeCount && !/^\d+(\.\d+)?$/.test(employeeCount))
      throw new Error('Invalid employee count.');
    const hint = text(row, 'Status/Research Hint');
    return {
      id,
      name,
      name_source: text(row, 'Name Source'),
      website_url: text(row, 'Website URL'),
      careerUrl: text(row, 'Career URL'),
      linkedin_url: text(row, 'LinkedIn URL'),
      email: text(row, 'Email'),
      location: text(row, 'Location'),
      tech_stack: text(row, 'Tech Stack'),
      employee_count_hint: employeeCount,
      aiub_total_hint: text(row, 'AIUB/Total Hint'),
      status_research_hint: hint,
      notes: text(row, 'Notes'),
      additional_websites: text(row, 'Additional Websites'),
      additional_career_urls: text(row, 'Additional Career URLs'),
      additional_linkedin_urls: text(row, 'Additional LinkedIn URLs'),
      additional_emails: text(row, 'Additional Emails'),
      corporate_domains: text(row, 'Corporate Domains'),
      source_rows: text(row, 'Source Rows'),
      source_row_count: count,
      needs_manual_review: boolean(row, 'Needs Manual Review'),
      review_reasons: text(row, 'Review Reasons'),
      needs_enrichment: boolean(row, 'Needs Enrichment'),
      enrichment_reasons: text(row, 'Enrichment Reasons'),
      active: boolean(row, 'Active'),
      recommended_action: /no hiring page|nhpf/i.test(hint ?? '')
        ? 'NO_HIRING_PAGE_FOUND'
        : text(row, 'Recommended Action'),
    };
  });
  // Parse only the two known VALUES blocks. Never execute the legacy SQL seed,
  // whose ON CONFLICT updates would overwrite operator-maintained records.
  function tuples(block: string | undefined, width: number): string[][] {
    if (!block) throw new Error('Category seed source layout changed.');
    const result: string[][] = [];
    const remainder = block.replace(/\((?:'(?:[^']|'')*'\s*,?\s*)+\)/g, (tuple) => {
      const values = [...tuple.matchAll(/'((?:[^']|'')*)'/g)].map((match) =>
        match[1].replace(/''/g, "'"),
      );
      if (values.length !== width) throw new Error('Invalid category seed tuple.');
      result.push(values);
      return '';
    });
    if (remainder.replace(/[\s,]/g, '') || !result.length)
      throw new Error('Unsupported category seed values.');
    return result;
  }
  const categories = tuples(
    sql.match(/INSERT INTO categories \(name,type\) VALUES([\s\S]*?)ON CONFLICT/)?.[1],
    2,
  ).map(([name, type]) => ({ name, type }));
  const names = new Set(categories.map((category) => category.name));
  if (
    names.size !== categories.length ||
    categories.some(
      (category) => !['technology', 'domain', 'sector', 'other'].includes(category.type),
    )
  ) {
    throw new Error('Invalid category identity or type.');
  }
  const assignments = tuples(
    sql.match(
      /WITH assignments\(company_id, category_name, source\) AS \(VALUES([\s\S]*?)\)\s*INSERT INTO company_categories/,
    )?.[1],
    3,
  ).map(([companyId, categoryName, source]) => ({ companyId, categoryName, source }));
  if (assignments.some((item) => !ids.has(item.companyId) || !names.has(item.categoryName)))
    throw new Error('Seed assignment references unknown company/category.');
  return {
    companies,
    categories,
    assignments,
    fingerprints: {
      companies: createHash('sha256').update(csv).digest('hex'),
      categories: createHash('sha256').update(sql).digest('hex'),
    },
  };
}
