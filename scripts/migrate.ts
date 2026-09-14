import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, closeDb } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = await fs.readFile(path.join(here, '../sql/001_init.sql'), 'utf8');

try {
  await db.query('BEGIN');
  await db.query(sql);
  await db.query('COMMIT');
  console.log('Migration completed.');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await closeDb();
}
