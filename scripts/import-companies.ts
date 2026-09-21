import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';
import { db, closeDb } from '../src/db.js';

type Row = Record<string, string>;

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '../data/clean_company_candidates.csv');

function blankToNull(value?: string): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function asBoolean(value?: string): boolean {
  return ['yes', 'true', '1', 'y'].includes((value ?? '').trim().toLowerCase());
}

function asNumber(value?: string): number | null {
  const v = value?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const parser = fs
  .createReadStream(file)
  .pipe(parse({ columns: true, skip_empty_lines: true, bom: true, relax_quotes: true }));
let imported = 0;

try {
  await db.query('BEGIN');
  for await (const row of parser as AsyncIterable<Row>) {
    await db.query(
      `INSERT INTO companies (
        id, name, name_source, website_url, career_url, linkedin_url, email, location,
        tech_stack, employee_count_hint, aiub_total_hint, status_research_hint, notes,
        additional_websites, additional_career_urls, additional_linkedin_urls, additional_emails,
        corporate_domains, source_rows, source_row_count, needs_manual_review, review_reasons,
        needs_enrichment, enrichment_reasons, active, recommended_action, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,now()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        name_source = EXCLUDED.name_source,
        website_url = EXCLUDED.website_url,
        career_url = EXCLUDED.career_url,
        linkedin_url = EXCLUDED.linkedin_url,
        email = EXCLUDED.email,
        location = EXCLUDED.location,
        tech_stack = EXCLUDED.tech_stack,
        employee_count_hint = EXCLUDED.employee_count_hint,
        aiub_total_hint = EXCLUDED.aiub_total_hint,
        status_research_hint = EXCLUDED.status_research_hint,
        notes = EXCLUDED.notes,
        additional_websites = EXCLUDED.additional_websites,
        additional_career_urls = EXCLUDED.additional_career_urls,
        additional_linkedin_urls = EXCLUDED.additional_linkedin_urls,
        additional_emails = EXCLUDED.additional_emails,
        corporate_domains = EXCLUDED.corporate_domains,
        source_rows = EXCLUDED.source_rows,
        source_row_count = EXCLUDED.source_row_count,
        needs_manual_review = EXCLUDED.needs_manual_review,
        review_reasons = EXCLUDED.review_reasons,
        needs_enrichment = EXCLUDED.needs_enrichment,
        enrichment_reasons = EXCLUDED.enrichment_reasons,
        active = EXCLUDED.active,
        recommended_action = EXCLUDED.recommended_action,
        updated_at = now()`,
      [
        row['Company ID'],
        row['Company Name'],
        blankToNull(row['Name Source']),
        blankToNull(row['Website URL']),
        blankToNull(row['Career URL']),
        blankToNull(row['LinkedIn URL']),
        blankToNull(row['Email']),
        blankToNull(row['Location']),
        blankToNull(row['Tech Stack']),
        asNumber(row['Employee Count Hint']),
        blankToNull(row['AIUB/Total Hint']),
        blankToNull(row['Status/Research Hint']),
        blankToNull(row['Notes']),
        blankToNull(row['Additional Websites']),
        blankToNull(row['Additional Career URLs']),
        blankToNull(row['Additional LinkedIn URLs']),
        blankToNull(row['Additional Emails']),
        blankToNull(row['Corporate Domains']),
        blankToNull(row['Source Rows']),
        Number(row['Source Row Count'] || 1),
        asBoolean(row['Needs Manual Review']),
        blankToNull(row['Review Reasons']),
        asBoolean(row['Needs Enrichment']),
        blankToNull(row['Enrichment Reasons']),
        asBoolean(row['Active']),
        blankToNull(row['Recommended Action']),
      ],
    );
    imported += 1;
  }
  await db.query('COMMIT');
  console.log(`Imported/upserted ${imported} companies.`);
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await closeDb();
}
