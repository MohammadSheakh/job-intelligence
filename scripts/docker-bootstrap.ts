import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, closeDb } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.join(here, '../sql');

async function runFile(name: string): Promise<void> {
  const sql = await fs.readFile(path.join(sqlDir, name), 'utf8');
  await db.query(sql);
  console.log(`[bootstrap] applied ${name}`);
}

async function tableCount(table: string): Promise<number> {
  const result = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

try {
  // Core schema is idempotent and safe to run on every container start.
  await runFile('001_init.sql');
  await runFile('005_candidate_category_preferences.sql');
  await runFile('008_runtime_schema.sql');

  // Seed the packaged company/category dataset only for a brand-new local DB.
  const companies = await tableCount('companies');
  if (companies === 0) {
    console.log('[bootstrap] empty database detected; seeding company dataset');
    await runFile('002_import_companies.sql');
    await runFile('004_categories_and_assignments.sql');

    // Normalize research-only NHPF labels for the local seed.
    await db.query(`
      UPDATE companies
      SET status_research_hint='NHPF - No Hiring Page Found',
          recommended_action='NO_HIRING_PAGE_FOUND',
          updated_at=now()
      WHERE lower(coalesce(status_research_hint,'')) LIKE '%no hiring page%'
    `);

    // Keep the two verified URL corrections used by the live project.
    await db.query(
      `UPDATE companies SET career_url='https://genexinfosys.com/career', updated_at=now() WHERE id='C0019'`,
    );
    await db.query(
      `UPDATE companies SET career_url='https://incrosoft.com/careers', updated_at=now() WHERE id='C0027'`,
    );
  } else {
    console.log(
      `[bootstrap] existing database detected (${companies} companies); data seed skipped`,
    );
  }

  // Re-apply runtime schema after a first seed so optional categories/settings exist.
  await runFile('008_runtime_schema.sql');

  const categoryCount = await tableCount('categories');
  const candidateCount = await tableCount('candidates');
  console.log(
    `[bootstrap] ready: companies=${await tableCount('companies')} categories=${categoryCount} candidates=${candidateCount}`,
  );
} finally {
  await closeDb();
}
