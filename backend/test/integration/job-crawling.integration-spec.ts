import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/database';
import { parseDeadlineFromText } from '../../src/features/job-crawling/domain/career-page.parser';
import { createJobHash } from '../../src/features/job-crawling/domain/normalize';
import { CrawlIngestionService } from '../../src/features/job-crawling/services/crawl-ingestion.service';
import { AdminCrawlLogService } from '../../src/features/job-crawling/services/admin-crawl-log.service';
import { AdminJobCatalogService } from '../../src/features/job-crawling/services/admin-job-catalog.service';
import { CandidateRecommendationsService } from '../../src/features/matching/services/candidate-recommendations.service';

describe('Job crawling, deadline parsing, and freshness policy', () => {
  describe('parseDeadlineFromText', () => {
    it('parses natural textual dates with ordinal numbers', () => {
      const deadline = parseDeadlineFromText('Application Deadline: 15th October 2026');
      expect(deadline).not.toBeNull();
      expect(deadline?.getUTCFullYear()).toBe(2026);
      expect(deadline?.getUTCMonth()).toBe(9); // 0-indexed: October
      expect(deadline?.getUTCDate()).toBe(15);
    });

    it('parses natural textual dates with month name first', () => {
      const deadline = parseDeadlineFromText('Apply by November 20, 2026 for priority review');
      expect(deadline).not.toBeNull();
      expect(deadline?.getUTCFullYear()).toBe(2026);
      expect(deadline?.getUTCMonth()).toBe(10); // November
      expect(deadline?.getUTCDate()).toBe(20);
    });

    it('parses ISO date strings', () => {
      const deadline = parseDeadlineFromText('Deadline: 2026-12-31');
      expect(deadline).not.toBeNull();
      expect(deadline?.getUTCFullYear()).toBe(2026);
      expect(deadline?.getUTCMonth()).toBe(11); // December
      expect(deadline?.getUTCDate()).toBe(31);
    });

    it('parses "last date of application" variations', () => {
      const deadline = parseDeadlineFromText('Last date of application: 05 Jan 2027');
      expect(deadline).not.toBeNull();
      expect(deadline?.getUTCFullYear()).toBe(2027);
      expect(deadline?.getUTCMonth()).toBe(0); // January
      expect(deadline?.getUTCDate()).toBe(5);
    });

    it('returns null when no deadline pattern is present', () => {
      expect(parseDeadlineFromText('Join our engineering team today! Apply now.')).toBeNull();
    });
  });

  describe('CrawlIngestionService freshness rules and diagnostics', () => {
    let module: TestingModule;
    let service: CrawlIngestionService;
    const transaction = {
      company: { updateMany: jest.fn() },
      job: { upsert: jest.fn(), findMany: jest.fn() },
      crawlLog: { create: jest.fn() },
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      transaction.company.updateMany.mockResolvedValue({ count: 1 });
      transaction.job.findMany.mockResolvedValue([]);
      transaction.job.upsert.mockResolvedValue({});
      transaction.crawlLog.create.mockResolvedValue({ id: 1n });

      module = await Test.createTestingModule({
        providers: [
          CrawlIngestionService,
          {
            provide: PrismaService,
            useValue: {
              $transaction: jest.fn(async (work) =>
                typeof work === 'function' ? work(transaction) : Promise.all(work),
              ),
            },
          },
        ],
      }).compile();

      service = module.get(CrawlIngestionService);
    });

    afterEach(async () => module.close());

    it('persists future deadline and marks job OPEN', async () => {
      const futureDeadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const pageHtml = `
        <html><body>
          <h2>Senior Full-Stack Engineer</h2>
          <a href="/careers/apply">Apply here</a>
          <p>Deadline: ${futureDeadline.toISOString().slice(0, 10)}</p>
        </body></html>
      `;

      await service.ingest('comp-1', {
        requestedUrl: 'https://comp1.com/careers',
        finalUrl: 'https://comp1.com/careers',
        httpStatus: 200,
        html: pageHtml,
      });

      expect(transaction.job.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            title: 'Senior Full-Stack Engineer',
            status: 'OPEN',
            application_deadline: expect.any(Date),
          }),
        }),
      );
    });

    it('marks backdated/expired vacancy as CLOSED at crawl time', async () => {
      const pastDeadline = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const pageHtml = `
        <html><body>
          <h2>Junior Backend Developer</h2>
          <a href="/jobs/123/apply">Apply Now</a>
          <p>Deadline: ${pastDeadline.toISOString().slice(0, 10)}</p>
        </body></html>
      `;

      await service.ingest('comp-1', {
        requestedUrl: 'https://comp1.com/careers',
        finalUrl: 'https://comp1.com/careers',
        httpStatus: 200,
        html: pageHtml,
      });

      expect(transaction.job.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            title: 'Junior Backend Developer',
            status: 'CLOSED',
          }),
        }),
      );
    });

    it('records job creation vs update deltas and full diagnostic metadata in crawl log', async () => {
      const pageHtml = `
        <html><body>
          <h2>Frontend Specialist</h2>
          <a href="/jobs/fe">Apply</a>
          <h2>Backend Architect</h2>
          <a href="/jobs/be">Apply</a>
        </body></html>
      `;

      // Simulate one job existing already
      const existingHash = createJobHash({
        companyId: 'comp-1',
        title: 'Frontend Specialist',
        location: undefined,
        applicationUrl: 'https://comp1.com/jobs/fe',
      });
      transaction.job.findMany.mockResolvedValue([{ jobHash: existingHash }]);

      const result = await service.ingest('comp-1', {
        requestedUrl: 'https://comp1.com/careers',
        finalUrl: 'https://comp1.com/careers',
        httpStatus: 200,
        durationMs: 840,
        crawlerType: 'Generic HTML',
        html: pageHtml,
      });

      expect(result.jobsFound).toBe(2);
      expect(result.durationMs).toBe(840);
      expect(result.crawlerType).toBe('Generic HTML');

      expect(transaction.crawlLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          company_id: 'comp-1',
          success: true,
          jobs_found: 2,
          jobs_created: 1,
          jobs_updated: 1,
          http_status: 200,
          duration_ms: 840,
          crawler_type: 'Generic HTML',
          action_taken: 'MONITOR_READY',
        }),
      });
    });

    it('recordFailure deduces CUSTOM_ADAPTER_REQUIRED on 403 / Cloudflare challenges', async () => {
      await service.recordFailure('comp-2', 'Access denied: Cloudflare 403 Forbidden', {
        httpStatus: 403,
        durationMs: 320,
        crawlerType: 'Generic HTML',
      });

      expect(transaction.company.updateMany).toHaveBeenCalledWith({
        where: { id: 'comp-2' },
        data: { last_checked_at: expect.any(Date) },
      });

      expect(transaction.crawlLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          company_id: 'comp-2',
          success: false,
          jobs_found: 0,
          http_status: 403,
          duration_ms: 320,
          action_taken: 'CUSTOM_ADAPTER_REQUIRED',
          error: 'Access denied: Cloudflare 403 Forbidden',
        }),
      });
    });

    it('recordFailure deduces FIND_CAREER_PAGE on 404 page not found', async () => {
      await service.recordFailure('comp-3', 'HTTP 404 Not Found at /careers', {
        httpStatus: 404,
        durationMs: 190,
      });

      expect(transaction.company.updateMany).toHaveBeenCalledWith({
        where: { id: 'comp-3' },
        data: { last_checked_at: expect.any(Date) },
      });

      expect(transaction.crawlLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          company_id: 'comp-3',
          success: false,
          http_status: 404,
          duration_ms: 190,
          action_taken: 'FIND_CAREER_PAGE',
        }),
      });
    });

    it('recordFailure deduces RETRY_LATER on connection timeouts without updating recommended action', async () => {
      await service.recordFailure('comp-4', 'ETIMEDOUT: Connection timed out after 10000ms', {
        durationMs: 10050,
      });

      expect(transaction.company.updateMany).toHaveBeenCalledWith({
        where: { id: 'comp-4' },
        data: {
          last_checked_at: expect.any(Date),
        },
      });

      expect(transaction.crawlLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          company_id: 'comp-4',
          success: false,
          duration_ms: 10050,
          action_taken: 'RETRY_LATER',
        }),
      });
    });
  });

  describe('AdminJobCatalogService job links & deadline projection', () => {
    let module: TestingModule;
    let service: AdminJobCatalogService;
    const prisma = {
      job: { count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(async (work) => Promise.all(work)),
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      prisma.$transaction.mockImplementation(async (work) => Promise.all(work));
      module = await Test.createTestingModule({
        providers: [
          AdminJobCatalogService,
          {
            provide: PrismaService,
            useValue: prisma,
          },
        ],
      }).compile();

      service = module.get(AdminJobCatalogService);
    });

    afterEach(async () => module.close());

    it('projects applicationDeadline, companyWebsiteUrl, and companyId', async () => {
      const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      prisma.job.count.mockResolvedValue(1);
      prisma.job.findMany.mockResolvedValue([
        {
          id: 42n,
          title: 'DevOps Engineer',
          location: 'Dhaka',
          work_mode: 'Remote',
          skills: 'Docker, Kubernetes',
          experience: '3+ years',
          application_url: 'https://example.com/apply',
          application_deadline: deadline,
          status: 'OPEN',
          first_seen_at: new Date(),
          last_seen_at: new Date(),
          company: {
            id: 'c_example',
            name: 'Example Tech',
            website_url: 'https://example.com',
            categories: [{ category: { name: 'Technology' } }],
          },
        },
      ]);

      const result = await service.list({ page: 1, pageSize: 25 });
      expect(result.rows[0]).toMatchObject({
        id: '42',
        title: 'DevOps Engineer',
        companyId: 'c_example',
        companyName: 'Example Tech',
        companyWebsiteUrl: 'https://example.com',
        applicationDeadline: deadline,
      });
    });
  });

  describe('CandidateRecommendationsService freshness and deadline filtering', () => {
    let module: TestingModule;
    let service: CandidateRecommendationsService;
    const prisma = {
      candidate: { findFirst: jest.fn() },
      job: { findMany: jest.fn() },
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      prisma.candidate.findFirst.mockResolvedValue({
        expertise: 'Backend',
        skills: 'Node.js, PostgreSQL',
        experience_level: 'Mid',
        preferred_locations: null,
        excluded_locations: null,
        preferred_work_modes: null,
        preferred_categories: null,
        excluded_categories: null,
        minimum_match_score: 50,
      });

      module = await Test.createTestingModule({
        providers: [
          CandidateRecommendationsService,
          {
            provide: PrismaService,
            useValue: prisma,
          },
        ],
      }).compile();

      service = module.get(CandidateRecommendationsService);
    });

    afterEach(async () => module.close());

    it('enforces deadline filter and projects applicationDeadline', async () => {
      const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      prisma.job.findMany.mockResolvedValue([
        {
          id: 101n,
          companyId: 'c_node',
          title: 'Node.js Developer',
          description: 'Build backend APIs with Node.js and PostgreSQL',
          location: 'Dhaka',
          work_mode: 'Hybrid',
          skills: 'Node.js, PostgreSQL',
          experience: 'Mid',
          application_url: 'https://nodecorp.com/apply',
          application_deadline: deadline,
          company: {
            name: 'Node Corp',
            website_url: 'https://nodecorp.com',
            careerUrl: 'https://nodecorp.com/careers',
            location: 'Dhaka',
            tech_stack: 'Node.js, PostgreSQL',
            categories: [{ category: { name: 'Node.js', type: 'technology' } }],
            candidate_company_state: [],
          },
        },
      ]);

      const recommendations = await service.list(1n, 10);
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'OPEN',
            OR: [
              { application_deadline: null },
              { application_deadline: { gte: expect.any(Date) } },
            ],
            last_seen_at: { gte: expect.any(Date) },
          }),
        }),
      );
      expect(recommendations.length).toBe(1);
      expect(recommendations[0].applicationDeadline).toBe(deadline.toISOString());
      expect(recommendations[0].companyWebsiteUrl).toBe('https://nodecorp.com');
    });
  });

  describe('AdminCrawlLogService diagnostics and query filters', () => {
    let module: TestingModule;
    let service: AdminCrawlLogService;
    const prisma = {
      crawlLog: { count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(async (work) => Promise.all(work)),
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      prisma.$transaction.mockImplementation(async (work) => Promise.all(work));
      module = await Test.createTestingModule({
        providers: [
          AdminCrawlLogService,
          {
            provide: PrismaService,
            useValue: prisma,
          },
        ],
      }).compile();

      service = module.get(AdminCrawlLogService);
    });

    afterEach(async () => module.close());

    it('filters logs by search and success, projecting career url and diagnostics', async () => {
      const checkedAt = new Date('2026-09-22T10:00:00.000Z');
      prisma.crawlLog.count.mockResolvedValue(1);
      prisma.crawlLog.findMany.mockResolvedValue([
        {
          id: 501n,
          company_id: 'comp-abc',
          checked_at: checkedAt,
          success: true,
          jobs_found: 8,
          http_status: 200,
          duration_ms: 1250,
          crawler_type: 'Generic HTML',
          jobs_created: 2,
          jobs_updated: 6,
          action_taken: 'MONITOR_READY',
          error: null,
          companies: {
            name: 'Acme Corp',
            careerUrl: 'https://acme.example/careers',
            website_url: 'https://acme.example',
            recommended_action: 'MONITOR_READY',
          },
        },
      ]);

      const result = await service.list({ page: 1, pageSize: 25, search: 'Acme', success: true });

      expect(prisma.crawlLog.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          success: true,
          companies: {
            name: { contains: 'Acme', mode: 'insensitive' },
          },
        }),
      });

      expect(result.rows.length).toBe(1);
      expect(result.rows[0]).toEqual({
        id: '501',
        companyId: 'comp-abc',
        companyName: 'Acme Corp',
        careerUrl: 'https://acme.example/careers',
        websiteUrl: 'https://acme.example',
        recommendedAction: 'MONITOR_READY',
        checkedAt,
        success: true,
        jobsFound: 8,
        httpStatus: 200,
        durationMs: 1250,
        crawlerType: 'Generic HTML',
        jobsCreated: 2,
        jobsUpdated: 6,
        actionTaken: 'MONITOR_READY',
        error: null,
      });
    });
  });
});
