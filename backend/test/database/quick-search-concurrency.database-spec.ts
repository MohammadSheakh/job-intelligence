import 'reflect-metadata';
import { Global, HttpException, HttpStatus, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@app/database';
import { SettingsModule } from '../../src/features/settings/settings.module.js';
import { SettingsService } from '../../src/features/settings/services/settings.service.js';
import { QuickSearchQuotaService } from '../../src/features/quick-search/services/quick-search-quota.service.js';

import { AppConfigService } from '../../src/config/config.service.js';

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useValue: { app: { adminUsername: 'test-admin', adminPassword: 'test-password' } },
    },
  ],
  exports: [AppConfigService],
})
class TestConfigurationModule {}

describe('Quick Search concurrency and PostgreSQL advisory lock (real database)', () => {
  let prisma: PrismaService;
  let quotaService: QuickSearchQuotaService;
  let settingsService: SettingsService;
  let testCandidateId: bigint;

  let fixture: TestingModule;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
    if (
      process.env.JI_DISPOSABLE_DATABASE !== 'true' ||
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/ji_migration_test' ||
      url.username !== 'ji_test'
    ) {
      throw new Error('Run pnpm test:database to provision a disposable local database.');
    }

    fixture = await Test.createTestingModule({
      imports: [TestConfigurationModule, PrismaModule, SettingsModule],
      providers: [QuickSearchQuotaService],
    }).compile();

    prisma = fixture.get(PrismaService);
    quotaService = fixture.get(QuickSearchQuotaService);
    settingsService = fixture.get(SettingsService);

    // Create an isolated test candidate
    const candidate = await prisma.candidate.create({
      data: {
        name: 'Concurrent Test Candidate',
        email: `concurrent-${Date.now()}@example.test`,
        active: true,
      },
      select: { id: true },
    });
    testCandidateId = candidate.id;
  });

  afterAll(async () => {
    try {
      if (testCandidateId && prisma) {
        await prisma.candidate_search_runs.deleteMany({
          where: { candidate_id: testCandidateId },
        });
        await prisma.candidate.delete({
          where: { id: testCandidateId },
        });
      }
    } finally {
      if (prisma) await prisma.$disconnect();
      if (fixture) await fixture.close();
    }
  });

  it('serializes parallel quota reservations via pg_advisory_xact_lock without race conditions', async () => {
    // Read configured daily limit from settings (or ensure it is a known number, e.g. 10)
    const settings = await settingsService.get();
    const limit = Math.min(settings.quickSearchDailyLimit, 5);

    // Temporarily set limit to 5 to make test fast and predictable
    await prisma.setting.upsert({
      where: { key: 'quick_search_daily_limit' },
      update: { value: String(limit) },
      create: { key: 'quick_search_daily_limit', value: String(limit) },
    });

    const CONCURRENT_REQUESTS = 12;
    const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
      quotaService.reserve(testCandidateId, 'STANDARD'),
    );

    const results = await Promise.allSettled(promises);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly `limit` requests must succeed
    expect(fulfilled.length).toBe(limit);

    // Remaining requests must be rejected with 429 Too Many Requests
    expect(rejected.length).toBe(CONCURRENT_REQUESTS - limit);

    for (const r of rejected) {
      if (r.status === 'rejected') {
        const error = r.reason as HttpException;
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const response = error.getResponse() as { code?: string };
        expect(response.code).toBe('QUICK_SEARCH_LIMIT_REACHED');
      }
    }

    // Verify database row count matches exactly the limit (no race condition phantom inserts)
    const countInDb = await prisma.candidate_search_runs.count({
      where: { candidate_id: testCandidateId },
    });
    expect(countInDb).toBe(limit);
  });
});
