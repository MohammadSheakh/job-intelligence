import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, closeDb } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const files = ['006_candidate_portal.sql', '007_quick_search.sql'];

try {
  await db.query('BEGIN');
  for (const file of files) {
    const sql = await fs.readFile(path.join(here, '../sql', file), 'utf8');
    await db.query(sql);
  }
  await db.query('COMMIT');
  console.log('Candidate portal + quick-search migrations completed.');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await closeDb();
}
