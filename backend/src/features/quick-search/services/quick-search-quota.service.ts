import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/database';
import { Prisma } from '@prisma/client';
import { SettingsService } from '../../settings/services/settings.service.js';

export type QuickSearchMode = 'STANDARD' | 'AI';
export interface QuickSearchUsage {
  used: number;
  aiUsed: number;
  dailyLimit: number;
  aiDailyLimit: number;
  remaining: number;
  aiRemaining: number;
  resetsAt: string;
}
type Limits = { quickSearchDailyLimit: number; quickSearchAiDailyLimit: number };
type UsageRow = { used: bigint; aiUsed: bigint; now: Date; resetsAt: Date };

/** Owns persistent per-candidate quotas shared by the legacy runtime and future Nest workers. */
@Injectable()
export class QuickSearchQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Read usage without reserving work; failures and unfinished reservations still consume quota. */
  async usage(candidateId: bigint): Promise<QuickSearchUsage> {
    const limits = await this.settings.get();
    const row = await this.count(this.prisma, candidateId);
    return this.project(row, limits);
  }

  /**
   * Reserve before network work. The advisory key matches the legacy implementation so
   * simultaneous legacy/Nest requests serialize across processes without an in-memory mutex.
   * Callers must verify mode availability before invoking this internal service.
   */
  async reserve(candidateId: bigint, mode: QuickSearchMode) {
    if (mode !== 'STANDARD' && mode !== 'AI') throw new BadRequestException('Invalid search mode.');
    const limits = await this.settings.get();
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${candidateId})`;
        const candidate = await transaction.candidate.findFirst({
          where: { id: candidateId, active: true },
          select: { id: true },
        });
        if (!candidate) throw new NotFoundException('Candidate profile was not found.');
        const counts = await this.count(transaction, candidateId);
        const usage = this.project(counts, limits);
        if (usage.remaining === 0 || (mode === 'AI' && usage.aiRemaining === 0)) {
          throw new HttpException(
            {
              code: 'QUICK_SEARCH_LIMIT_REACHED',
              message:
                usage.remaining === 0
                  ? 'Daily quick-search limit reached.'
                  : 'Daily AI quick-search limit reached.',
              usage,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        const run = await transaction.candidate_search_runs.create({
          data: { candidate_id: candidateId, mode, success: false, requested_at: counts.now },
          select: { id: true },
        });
        return {
          runId: run.id,
          usage: this.project(
            {
              ...counts,
              used: counts.used + 1n,
              aiUsed: counts.aiUsed + (mode === 'AI' ? 1n : 0n),
            },
            limits,
          ),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  /**
   * Compare raw timestamps to Dhaka day bounds so the existing candidate/time index remains
   * usable. Capture database time after lock acquisition, and reuse it for the inserted run
   * to avoid counting one day and inserting into the next at midnight.
   */
  private async count(client: Prisma.TransactionClient, candidateId: bigint): Promise<UsageRow> {
    const [row] = await client.$queryRaw<UsageRow[]>`
      WITH clock AS (SELECT statement_timestamp() AS now), bounds AS (
        SELECT now,
          date_trunc('day', now AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka' AS start_at,
          (date_trunc('day', now AT TIME ZONE 'Asia/Dhaka') + interval '1 day') AT TIME ZONE 'Asia/Dhaka' AS end_at
        FROM clock
      )
      SELECT count(r.id) AS used, count(r.id) FILTER (WHERE r.mode = 'AI') AS "aiUsed",
             b.now, b.end_at AS "resetsAt"
      FROM bounds b LEFT JOIN candidate_search_runs r
        ON r.candidate_id = ${candidateId} AND r.requested_at >= b.start_at AND r.requested_at < b.end_at
      GROUP BY b.now, b.end_at
    `;
    return row;
  }

  /** Clamp persisted settings to the same integer bounds accepted by the admin form. */
  private project(row: UsageRow, limits: Limits): QuickSearchUsage {
    const dailyLimit = Math.min(20, Math.max(0, Math.floor(limits.quickSearchDailyLimit)));
    const aiDailyLimit = Math.min(20, Math.max(0, Math.floor(limits.quickSearchAiDailyLimit)));
    const used = Number(row.used);
    const aiUsed = Number(row.aiUsed);
    return {
      used,
      aiUsed,
      dailyLimit,
      aiDailyLimit,
      remaining: Math.max(0, dailyLimit - used),
      aiRemaining: Math.max(0, aiDailyLimit - aiUsed),
      resetsAt: row.resetsAt.toISOString(),
    };
  }
}
