import { db } from '../db.js';

export type QuickSearchMode = 'STANDARD' | 'AI';

export interface QuickSearchUsage {
  used: number;
  aiUsed: number;
  dailyLimit: number;
  aiDailyLimit: number;
  remaining: number;
  aiRemaining: number;
}

export async function getQuickSearchUsage(candidateId: number, dailyLimit: number, aiDailyLimit: number): Promise<QuickSearchUsage> {
  const result = await db.query<{ used: string; ai_used: string }>(`
    SELECT count(*)::text AS used,
           count(*) FILTER (WHERE mode='AI')::text AS ai_used
    FROM candidate_search_runs
    WHERE candidate_id=$1
      AND (requested_at AT TIME ZONE 'Asia/Dhaka')::date = (now() AT TIME ZONE 'Asia/Dhaka')::date
  `, [candidateId]);
  const used = Number(result.rows[0]?.used ?? 0);
  const aiUsed = Number(result.rows[0]?.ai_used ?? 0);
  return {
    used,
    aiUsed,
    dailyLimit,
    aiDailyLimit,
    remaining: Math.max(0, dailyLimit - used),
    aiRemaining: Math.max(0, aiDailyLimit - aiUsed),
  };
}

export async function reserveQuickSearch(candidateId: number, mode: QuickSearchMode, dailyLimit: number, aiDailyLimit: number): Promise<{ runId: number; usage: QuickSearchUsage } | { runId: null; usage: QuickSearchUsage; reason: string }> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [candidateId]);
    const counts = await client.query<{ used: string; ai_used: string }>(`
      SELECT count(*)::text AS used,
             count(*) FILTER (WHERE mode='AI')::text AS ai_used
      FROM candidate_search_runs
      WHERE candidate_id=$1
        AND (requested_at AT TIME ZONE 'Asia/Dhaka')::date = (now() AT TIME ZONE 'Asia/Dhaka')::date
    `, [candidateId]);
    const used = Number(counts.rows[0]?.used ?? 0);
    const aiUsed = Number(counts.rows[0]?.ai_used ?? 0);
    const usage: QuickSearchUsage = {
      used,
      aiUsed,
      dailyLimit,
      aiDailyLimit,
      remaining: Math.max(0, dailyLimit - used),
      aiRemaining: Math.max(0, aiDailyLimit - aiUsed),
    };
    if (dailyLimit <= 0 || used >= dailyLimit) {
      await client.query('ROLLBACK');
      return { runId: null, usage, reason: 'Daily quick-search limit reached.' };
    }
    if (mode === 'AI' && (aiDailyLimit <= 0 || aiUsed >= aiDailyLimit)) {
      await client.query('ROLLBACK');
      return { runId: null, usage, reason: 'Daily AI quick-search limit reached.' };
    }
    const inserted = await client.query<{ id: string | number }>(`
      INSERT INTO candidate_search_runs(candidate_id,mode,success)
      VALUES($1,$2,false)
      RETURNING id
    `, [candidateId, mode]);
    await client.query('COMMIT');
    const newUsed = used + 1;
    const newAiUsed = aiUsed + (mode === 'AI' ? 1 : 0);
    return {
      runId: Number(inserted.rows[0].id),
      usage: {
        used: newUsed,
        aiUsed: newAiUsed,
        dailyLimit,
        aiDailyLimit,
        remaining: Math.max(0, dailyLimit - newUsed),
        aiRemaining: Math.max(0, aiDailyLimit - newAiUsed),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function finishQuickSearchRun(runId: number, input: { companiesChecked: number; jobsFound: number; matchesFound: number; success: boolean; error?: string }): Promise<void> {
  await db.query(`
    UPDATE candidate_search_runs
    SET companies_checked=$2,jobs_found=$3,matches_found=$4,success=$5,error=$6
    WHERE id=$1
  `, [runId, input.companiesChecked, input.jobsFound, input.matchesFound, input.success, input.error ?? null]);
}
