import 'reflect-metadata';
import { Global, Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { AppConfigService } from '../src/config/config.service';
import { AuthenticationModule } from '../src/features/authentication/authentication.module';
import { AdminOperationsModule } from '../src/features/admin-operations/admin-operations.module';
import { SettingsModule } from '../src/features/settings/settings.module';
import { AdminDashboardService } from '../src/features/admin-operations/services/admin-dashboard.service';

const prisma = {
  company: { count: jest.fn() },
  job: { count: jest.fn() },
  candidate: { count: jest.fn() },
  notification: { count: jest.fn() },
  crawlLog: { count: jest.fn(), findMany: jest.fn() },
  setting: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: prisma },
    {
      provide: AppConfigService,
      useValue: { app: { adminUsername: 'test-admin', adminPassword: 'test-admin-password' } },
    },
  ],
  exports: [PrismaService, AppConfigService],
})
class TestInfrastructureModule {}

describe('Admin Dashboard Service and HTTP Controller', () => {
  let app: INestApplication;
  let dashboardService: AdminDashboardService;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [
        TestInfrastructureModule,
        AuthenticationModule,
        SettingsModule,
        AdminOperationsModule,
      ],
    }).compile();

    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dashboardService = app.get(AdminDashboardService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('AdminDashboardService unit tests', () => {
    it('aggregates operational statistics, settings, and recent crawl events', async () => {
      prisma.company.count
        .mockResolvedValueOnce(150) // total companies
        .mockResolvedValueOnce(45); // monitor ready
      prisma.job.count
        .mockResolvedValueOnce(320) // total jobs
        .mockResolvedValueOnce(85); // open jobs
      prisma.candidate.count.mockResolvedValueOnce(12); // active candidates
      prisma.notification.count.mockResolvedValueOnce(420); // notifications
      prisma.crawlLog.count.mockResolvedValueOnce(3); // crawl failures 24h
      prisma.crawlLog.findMany.mockResolvedValueOnce([
        {
          id: 101n,
          checked_at: new Date('2026-09-22T10:00:00Z'),
          success: true,
          jobs_found: 4,
          error: null,
          companies: { name: 'Acme Corp' },
        },
        {
          id: 102n,
          checked_at: new Date('2026-09-22T09:30:00Z'),
          success: false,
          jobs_found: 0,
          error: 'Connection timeout',
          companies: { name: 'Beta Ltd' },
        },
      ]);
      prisma.setting.findMany.mockResolvedValueOnce([]);

      const result = await dashboardService.getDashboard();

      expect(result.stats).toEqual({
        companies: 150,
        monitorReady: 45,
        jobs: 320,
        openJobs: 85,
        candidates: 12,
        notifications: 420,
        crawlFailures24h: 3,
      });

      expect(result.recentCrawlLogs).toHaveLength(2);
      expect(result.recentCrawlLogs[0]).toEqual({
        id: '101',
        companyName: 'Acme Corp',
        checkedAt: new Date('2026-09-22T10:00:00Z'),
        success: true,
        jobsFound: 4,
        error: null,
      });
      expect(result.recentCrawlLogs[1]).toEqual({
        id: '102',
        companyName: 'Beta Ltd',
        checkedAt: new Date('2026-09-22T09:30:00Z'),
        success: false,
        jobsFound: 0,
        error: 'Connection timeout',
      });

      expect(result.settings.aiEnabled).toBeDefined();
      expect(result.settings.emailEnabled).toBeDefined();
    });
  });

  describe('AdminDashboardController HTTP integration', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/dashboard').expect(401);
    });

    it('rejects incorrect basic auth credentials with HTTP 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .auth('test-admin', 'wrong-password')
        .expect(401);
    });

    it('returns dashboard data with HTTP 200 when properly authenticated', async () => {
      prisma.company.count.mockResolvedValueOnce(50).mockResolvedValueOnce(20);
      prisma.job.count.mockResolvedValueOnce(100).mockResolvedValueOnce(30);
      prisma.candidate.count.mockResolvedValueOnce(5);
      prisma.notification.count.mockResolvedValueOnce(25);
      prisma.crawlLog.count.mockResolvedValueOnce(1);
      prisma.crawlLog.findMany.mockResolvedValueOnce([]);
      prisma.setting.findMany.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .auth('test-admin', 'test-admin-password')
        .expect(200);

      expect(res.body.stats).toEqual({
        companies: 50,
        monitorReady: 20,
        jobs: 100,
        openJobs: 30,
        candidates: 5,
        notifications: 25,
        crawlFailures24h: 1,
      });
      expect(res.body.recentCrawlLogs).toEqual([]);
      expect(res.body.settings).toBeDefined();
    });
  });
});
