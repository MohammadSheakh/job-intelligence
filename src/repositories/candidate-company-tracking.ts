import { db } from '../db.js';

export async function getBlacklistedPairSet(): Promise<Set<string>> {
  const result = await db.query<{ candidate_id:string|number; company_id:string }>(`
    SELECT candidate_id,company_id FROM candidate_company_state WHERE status='EXCLUDED'
  `);
  return new Set(result.rows.map((row) => `${Number(row.candidate_id)}:${row.company_id}`));
}
