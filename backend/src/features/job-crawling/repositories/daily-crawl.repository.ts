import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { Client } from 'pg';
import type { CompanyForCrawl } from '../domain/types.js';

/** Bounded crawl catalog reads and a dedicated session lock, independent of Prisma transactions. */
@Injectable()
export class DailyCrawlRepository implements OnModuleDestroy {
  private lockClient: Client | null = null;
  private lockHealthy = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Hold one dedicated connection for the run; never put a session lock on a pooled connection. */
  async acquireRunLock(): Promise<boolean> {
    if (this.lockClient) return false;
    const connectionString = process.env.CRAWLER_LOCK_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString || new URL(connectionString).hostname.includes('-pooler.'))
      throw new Error('Daily crawl locking requires a direct database connection.');
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
      keepAlive: true,
    });
    this.lockClient = client;
    client.on('error', () => {
      this.lockHealthy = false;
    });
    client.on('end', () => {
      this.lockHealthy = false;
    });
    try {
      await client.connect();
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(124631, 1) AS acquired',
      );
      this.lockHealthy = result.rows[0]?.acquired === true;
      if (!this.lockHealthy) await this.releaseRunLock();
      return this.lockHealthy;
    } catch {
      await this.releaseRunLock();
      throw new Error('Daily crawl lock connection failed.');
    }
  }

  /** Fail closed between work phases if the lock session has failed or been disconnected. */
  async assertRunLock(): Promise<void> {
    if (!this.lockClient || !this.lockHealthy) throw new Error('Daily crawl lock was lost.');
    try {
      await this.lockClient.query('SELECT 1');
    } catch {
      this.lockHealthy = false;
      throw new Error('Daily crawl lock was lost.');
    }
    if (!this.lockHealthy) throw new Error('Daily crawl lock was lost.');
  }

  /** Connection teardown releases the session lock even on exceptional completion. */
  async releaseRunLock(): Promise<void> {
    const client = this.lockClient;
    this.lockClient = null;
    this.lockHealthy = false;
    if (client) await client.end();
  }

  async onModuleDestroy(): Promise<void> {
    await this.releaseRunLock();
  }

  /** Fix an upper key before paging so newly appended companies cannot extend the run forever. */
  async getUpperId(): Promise<string | null> {
    const company = await this.prisma.company.findFirst({
      where: { active: true, recommended_action: 'MONITOR_READY', careerUrl: { not: null } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    return company?.id ?? null;
  }

  /** Filter in PostgreSQL and project only the data needed for a single bounded batch. */
  async findBatch(upperId: string, afterId?: string): Promise<CompanyForCrawl[]> {
    const companies = await this.prisma.company.findMany({
      where: {
        active: true,
        recommended_action: 'MONITOR_READY',
        careerUrl: { not: null },
        id: { lte: upperId, ...(afterId ? { gt: afterId } : {}) },
      },
      orderBy: { id: 'asc' },
      take: 50,
      select: { id: true, name: true, careerUrl: true },
    });
    // Keep empty URLs in the page so their IDs still advance the keyset cursor.
    return companies.map((company) => ({ ...company, careerUrl: company.careerUrl ?? '' }));
  }
}
