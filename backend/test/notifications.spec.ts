import 'reflect-metadata';
import { EmailRenderService } from '../src/features/notifications/services/email-render.service.js';
import { EmailTransportService } from '../src/features/notifications/services/email-transport.service.js';
import { NotificationDeduplicationService } from '../src/features/notifications/services/notification-deduplication.service.js';
import { DailyNotificationService } from '../src/features/notifications/services/daily-notification.service.js';
import type { PrismaService } from '@app/database';
import type { SettingsService } from '../src/features/settings/services/settings.service.js';
import type { AiMatchEnhancerService } from '../src/features/matching/services/ai-match-enhancer.service.js';
import type { DigestMatch } from '../src/features/notifications/domain/types.js';

describe('Notifications subsystem', () => {
  describe('EmailRenderService', () => {
    let renderer: EmailRenderService;

    beforeEach(() => {
      renderer = new EmailRenderService();
    });

    const sampleMatch: DigestMatch = {
      candidate: {
        id: 1n,
        name: 'Jane Doe',
        email: 'jane@example.test',
      },
      job: {
        id: 101n,
        title: 'Senior <script>alert("xss")</script> Engineer',
        companyName: 'Acme & Sons Corp',
        companyWebsiteUrl: 'https://acme.test',
        applicationUrl: 'https://acme.test/apply',
        location: 'Remote',
        workMode: 'REMOTE',
        skills: 'TypeScript, NestJS',
      },
      threshold: 70,
      result: {
        eligible: true,
        deterministicScore: 85,
        finalScore: 85,
        breakdown: {},
        matchedSkills: ['TypeScript'],
        matchedCompanyCategories: ['Engineering'],
        matchedPreferredCategories: [],
        reasons: ['Strong skills alignment'],
        aiUsed: false,
      },
    };

    it('pluralizes subject line correctly for single and multiple matches', () => {
      const single = renderer.renderDigest('Jane', [sampleMatch]);
      expect(single.subject).toBe('1 new job match for you');

      const secondMatch: DigestMatch = {
        ...sampleMatch,
        job: { ...sampleMatch.job, id: 102n, title: 'Lead Architect' },
      };
      const multiple = renderer.renderDigest('Jane', [sampleMatch, secondMatch]);
      expect(multiple.subject).toBe('2 new job matches for you');
    });

    it('escapes HTML to prevent injection and formats safe links', () => {
      const rendered = renderer.renderDigest('Jane', [sampleMatch]);

      expect(rendered.html).not.toContain('<script>');
      expect(rendered.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(rendered.html).toContain('Acme &amp; Sons Corp');
      expect(rendered.html).toContain('href="https://acme.test/apply"');
      expect(rendered.text).toContain(
        'Senior <script>alert("xss")</script> Engineer — Acme & Sons Corp',
      );
    });

    it('rejects unsafe URL protocols like javascript:', () => {
      const unsafeMatch: DigestMatch = {
        ...sampleMatch,
        job: {
          ...sampleMatch.job,
          applicationUrl: 'javascript:alert(1)',
          companyWebsiteUrl: 'ftp://files.test',
        },
      };

      const rendered = renderer.renderDigest('Jane', [unsafeMatch]);
      expect(rendered.html).not.toContain('href="javascript:');
      expect(rendered.html).not.toContain('href="ftp:');
    });
  });

  describe('EmailTransportService', () => {
    const originalEnv = { ...process.env };
    let transport: EmailTransportService;

    beforeEach(() => {
      process.env = { ...originalEnv };
      transport = new EmailTransportService();
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('throws when SMTP credentials are not configured', async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      await expect(
        transport.send({
          to: 'test@example.test',
          subject: 'Test',
          text: 'Hello',
          html: '<p>Hello</p>',
        }),
      ).rejects.toThrow('SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM/SMTP_USER are required');
    });

    it('uses injected transporter override without real network connection', async () => {
      const fakeSendMail = jest.fn().mockResolvedValue({ messageId: '123' });
      transport.setTransporterOverride({
        sendMail: fakeSendMail,
      } as unknown as Parameters<typeof transport.setTransporterOverride>[0]);
      process.env.EMAIL_FROM = 'noreply@example.test';

      await transport.send({
        to: 'candidate@example.test',
        subject: 'Your Job Digest',
        text: 'Hello',
        html: '<p>Hello</p>',
      });

      expect(fakeSendMail).toHaveBeenCalledWith({
        from: 'noreply@example.test',
        to: 'candidate@example.test',
        subject: 'Your Job Digest',
        text: 'Hello',
        html: '<p>Hello</p>',
      });
    });
  });

  describe('NotificationDeduplicationService', () => {
    let mockPrisma: jest.Mocked<PrismaService>;
    let service: NotificationDeduplicationService;

    beforeEach(() => {
      mockPrisma = {
        notification: {
          findMany: jest.fn(),
          createMany: jest.fn(),
        },
      } as unknown as jest.Mocked<PrismaService>;
      service = new NotificationDeduplicationService(mockPrisma);
    });

    it('returns set of notified candidateId:jobId pairs', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([
        { candidate_id: 10n, job_id: 200n },
        { candidate_id: 10n, job_id: 201n },
      ]);

      const set = await service.getNotifiedPairSet();
      expect(set.has('10:200')).toBe(true);
      expect(set.has('10:201')).toBe(true);
      expect(set.has('10:202')).toBe(false);
    });

    it('records delivered notifications with skipDuplicates', async () => {
      (mockPrisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });

      await service.recordNotifications([
        { candidateId: 10n, jobId: 200n, matchScore: 85 },
        { candidateId: 10n, jobId: 201n, matchScore: 90 },
      ]);

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ candidate_id: 10n, job_id: 200n, match_score: 85 }),
          expect.objectContaining({ candidate_id: 10n, job_id: 201n, match_score: 90 }),
        ]),
        skipDuplicates: true,
      });
    });
  });

  describe('DailyNotificationService', () => {
    interface MockPrisma {
      candidate: { count: jest.Mock; findMany: jest.Mock };
      job: { count: jest.Mock; findMany: jest.Mock };
      candidate_company_state: { findMany: jest.Mock };
      notification: { findMany: jest.Mock; createMany: jest.Mock };
    }

    const createSettings = (
      overrides: Partial<Awaited<ReturnType<SettingsService['get']>>> = {},
    ) => ({
      aiEnabled: false,
      aiMatchingEnabled: false,
      aiDailyLimit: 0,
      aiProvider: '',
      aiSkillExtractionEnabled: false,
      defaultMatchThreshold: 70,
      emailEnabled: false,
      quickSearchDailyLimit: 3,
      quickSearchAiDailyLimit: 1,
      quickSearchCompanyLimit: 8,
      ...overrides,
    });

    let mockPrisma: MockPrisma;
    let mockSettings: jest.Mocked<SettingsService>;
    let renderer: EmailRenderService;
    let transport: EmailTransportService;
    let deduplication: NotificationDeduplicationService;
    let mockAiEnhancer: jest.Mocked<AiMatchEnhancerService>;
    let service: DailyNotificationService;
    let fakeSendMail: jest.Mock;

    beforeEach(() => {
      fakeSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
      renderer = new EmailRenderService();
      transport = new EmailTransportService();
      transport.setTransporterOverride({
        sendMail: fakeSendMail,
      } as unknown as Parameters<typeof transport.setTransporterOverride>[0]);
      process.env.EMAIL_FROM = 'noreply@example.test';

      mockPrisma = {
        candidate: { count: jest.fn(), findMany: jest.fn() },
        job: { count: jest.fn(), findMany: jest.fn() },
        candidate_company_state: { findMany: jest.fn() },
        notification: { findMany: jest.fn(), createMany: jest.fn() },
      };

      mockSettings = {
        get: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<SettingsService>;

      mockAiEnhancer = {
        isAvailable: jest.fn().mockResolvedValue(false),
        enhance: jest.fn(),
      } as unknown as jest.Mocked<AiMatchEnhancerService>;

      deduplication = new NotificationDeduplicationService(mockPrisma as unknown as PrismaService);
      service = new DailyNotificationService(
        mockPrisma as unknown as PrismaService,
        mockSettings,
        renderer,
        transport,
        deduplication,
        mockAiEnhancer,
      );
    });

    it('exits early without sending when emailEnabled is false', async () => {
      mockSettings.get.mockResolvedValue(
        createSettings({
          emailEnabled: false,
          defaultMatchThreshold: 70,
        }),
      );
      mockPrisma.candidate.count.mockResolvedValue(5);
      mockPrisma.job.count.mockResolvedValue(10);

      const summary = await service.run();

      expect(summary.emailEnabled).toBe(false);
      expect(summary.sentDigests).toBe(0);
      expect(summary.sentJobNotifications).toBe(0);
      expect(fakeSendMail).not.toHaveBeenCalled();
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('filters out already-notified jobs and excluded companies', async () => {
      mockSettings.get.mockResolvedValue(
        createSettings({
          emailEnabled: true,
          defaultMatchThreshold: 70,
        }),
      );

      // Active candidate
      mockPrisma.candidate.findMany.mockResolvedValue([
        {
          id: 1n,
          name: 'Alice Candidate',
          email: 'alice@example.test',
          expertise: 'Fullstack Engineer',
          skills: 'TypeScript, Node.js',
          experience_level: 'Senior',
          preferred_locations: null,
          excluded_locations: null,
          preferred_work_modes: null,
          preferred_categories: null,
          excluded_categories: null,
          minimum_match_score: 60,
        },
      ]);

      // Three jobs: job 101 (already notified), job 102 (company blacklisted), job 103 (valid match)
      mockPrisma.job.findMany.mockResolvedValue([
        {
          id: 101n,
          companyId: 'comp-1',
          title: 'Senior TypeScript Engineer',
          description: 'Great Node.js role',
          location: 'Remote',
          work_mode: 'REMOTE',
          skills: 'TypeScript, Node.js',
          experience: 'Senior',
          application_url: 'https://comp1.test/apply',
          company: {
            name: 'Company 1',
            website_url: 'https://comp1.test',
            location: 'Remote',
            tech_stack: 'Node.js',
            categories: [],
          },
        },
        {
          id: 102n,
          companyId: 'comp-2',
          title: 'Fullstack Developer',
          description: 'Fullstack engineer needed',
          location: 'Remote',
          work_mode: 'REMOTE',
          skills: 'TypeScript, Node.js',
          experience: 'Senior',
          application_url: 'https://comp2.test/apply',
          company: {
            name: 'Company 2',
            website_url: 'https://comp2.test',
            location: 'Remote',
            tech_stack: 'Node.js',
            categories: [],
          },
        },
        {
          id: 103n,
          companyId: 'comp-3',
          title: 'Senior Backend Engineer',
          description: 'Node.js and TypeScript',
          location: 'Remote',
          work_mode: 'REMOTE',
          skills: 'TypeScript, Node.js',
          experience: 'Senior',
          application_url: 'https://comp3.test/apply',
          company: {
            name: 'Company 3',
            website_url: 'https://comp3.test',
            location: 'Remote',
            tech_stack: 'Node.js',
            categories: [],
          },
        },
      ]);

      // Blacklist company comp-2 for candidate 1
      mockPrisma.candidate_company_state.findMany.mockResolvedValue([
        { candidate_id: 1n, company_id: 'comp-2' },
      ]);

      // Job 101 already notified
      mockPrisma.notification.findMany.mockResolvedValue([{ candidate_id: 1n, job_id: 101n }]);

      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      const summary = await service.run();

      expect(summary.emailEnabled).toBe(true);
      expect(summary.sentDigests).toBe(1);
      expect(summary.sentJobNotifications).toBe(1);
      expect(fakeSendMail).toHaveBeenCalledTimes(1);

      // Verify delivery recording
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            candidate_id: 1n,
            job_id: 103n,
          }),
        ],
        skipDuplicates: true,
      });
    });

    it('does not record notifications if email transport fails', async () => {
      mockSettings.get.mockResolvedValue(
        createSettings({
          emailEnabled: true,
          defaultMatchThreshold: 60,
        }),
      );

      mockPrisma.candidate.findMany.mockResolvedValue([
        {
          id: 2n,
          name: 'Bob Candidate',
          email: 'bob@example.test',
          expertise: 'Python Developer',
          skills: 'Python',
          minimum_match_score: 50,
        },
      ]);

      mockPrisma.job.findMany.mockResolvedValue([
        {
          id: 201n,
          companyId: 'comp-4',
          title: 'Python Developer',
          description: 'Python engineer role',
          skills: 'Python',
          company: { name: 'Comp 4', categories: [] },
        },
      ]);

      mockPrisma.candidate_company_state.findMany.mockResolvedValue([]);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      fakeSendMail.mockRejectedValueOnce(new Error('SMTP connection timed out'));

      const summary = await service.run();

      expect(summary.failedDigests).toBe(1);
      expect(summary.sentDigests).toBe(0);
      expect(summary.sentJobNotifications).toBe(0);
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });
  });
});
