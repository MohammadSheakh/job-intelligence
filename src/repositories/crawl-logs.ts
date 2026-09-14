import { db } from '../db.js';

export async function recordCrawlLog(input: {
  companyId: string;
  success: boolean;
  jobsFound: number;
  error?: string;
}): Promise<void> {
  await db.query(`
    INSERT INTO crawl_logs (company_id, success, jobs_found, error)
    VALUES ($1, $2, $3, $4)
  `, [input.companyId, input.success, input.jobsFound, input.error ?? null]);
}
