import { db } from '../db.js';

export async function getNotifiedPairSet(): Promise<Set<string>> {
  const result = await db.query<{ candidate_id: string | number; job_id: string | number }>(
    'SELECT candidate_id, job_id FROM notifications',
  );
  return new Set(result.rows.map((row) => `${row.candidate_id}:${row.job_id}`));
}

export async function recordNotification(
  candidateId: number,
  jobId: number,
  matchScore: number,
): Promise<void> {
  await db.query(
    `
    INSERT INTO notifications(candidate_id, job_id, match_score, sent_at)
    VALUES ($1, $2, $3, now())
    ON CONFLICT (candidate_id, job_id) DO NOTHING
  `,
    [candidateId, jobId, matchScore],
  );
}
