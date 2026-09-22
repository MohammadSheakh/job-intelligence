import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/database';
import { CareerPageFetcherService } from '../src/features/job-crawling/services/career-page-fetcher.service';
import { CompanyIntelligenceService } from '../src/features/company-intelligence/services/company-intelligence.service';

describe('CompanyIntelligenceService', () => {
  let module: TestingModule;
  let service: CompanyIntelligenceService;
  let fetcherMock: { fetch: jest.Mock };

  const transaction = {
    company: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    category: { findMany: jest.fn() },
    companyCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    transaction.company.findUnique.mockResolvedValue({ id: 'company-1' });
    transaction.category.findMany.mockResolvedValue([{ id: 7n }]);
    fetcherMock = {
      fetch: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        CompanyIntelligenceService,
        {
          provide: CareerPageFetcherService,
          useValue: fetcherMock,
        },
        {
          provide: PrismaService,
          useValue: {
            ...transaction,
            $transaction: jest.fn(async (work) =>
              typeof work === 'function' ? work(transaction) : Promise.all(work),
            ),
          },
        },
      ],
    }).compile();
    service = module.get(CompanyIntelligenceService);
  });

  afterEach(async () => module.close());

  describe('Company category replacement & update', () => {
    it('normalizes categories and replaces assignments through the transaction', async () => {
      await service.update('company-1', {
        name: ' Example ',
        active: true,
        categories: [' TypeScript ', 'TypeScript'],
      });
      expect(transaction.category.findMany).toHaveBeenCalledWith({
        where: { name: { in: ['TypeScript'] } },
        select: { id: true },
      });
      expect(transaction.company.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Example' }) }),
      );
      expect(transaction.companyCategory.deleteMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
      });
      expect(transaction.companyCategory.createMany).toHaveBeenCalledWith({
        data: [{ companyId: 'company-1', categoryId: 7n, source: 'admin' }],
      });
    });

    it('uses Other when all categories are removed', async () => {
      await service.update('company-1', { name: 'Example', active: true, categories: [] });
      expect(transaction.category.findMany).toHaveBeenCalledWith({
        where: { name: { in: ['Other'] } },
        select: { id: true },
      });
    });

    it('rejects unknown categories before changing the company or its assignments', async () => {
      transaction.category.findMany.mockResolvedValue([]);
      await expect(
        service.update('company-1', { name: 'Example', active: true, categories: ['Unknown'] }),
      ).rejects.toMatchObject({ status: 404 });
      expect(transaction.company.update).not.toHaveBeenCalled();
      expect(transaction.companyCategory.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects a missing company without writing', async () => {
      transaction.company.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { name: 'Example', active: true, categories: [] }),
      ).rejects.toMatchObject({ status: 404 });
      expect(transaction.company.update).not.toHaveBeenCalled();
    });
  });

  describe('Company creation', () => {
    it('creates a new company with slugified ID and categories', async () => {
      transaction.company.findUnique.mockResolvedValue(null);
      transaction.category.findMany.mockResolvedValue([{ id: 10n }]);

      const result = await service.create({
        name: 'Tech Innovations Ltd',
        careerUrl: 'https://techinnovations.com/careers',
        categories: ['Technology'],
      });

      expect(result.name).toBe('Tech Innovations Ltd');
      expect(result.id).toMatch(/^c_tech-innovations-ltd/);
      expect(transaction.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Tech Innovations Ltd',
            careerUrl: 'https://techinnovations.com/careers',
            recommended_action: 'MONITOR_READY',
          }),
        }),
      );
      expect(transaction.companyCategory.createMany).toHaveBeenCalledWith({
        data: [{ companyId: result.id, categoryId: 10n, source: 'admin' }],
      });
    });

    it('infers FIND_CAREER_PAGE when only website is provided', async () => {
      transaction.company.findUnique.mockResolvedValue(null);
      transaction.category.findMany.mockResolvedValue([{ id: 1n }]);

      await service.create({
        name: 'Website Only Co',
        websiteUrl: 'https://websiteonly.com',
      });

      expect(transaction.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recommended_action: 'FIND_CAREER_PAGE',
          }),
        }),
      );
    });

    it('infers ENRICH_FROM_LINKEDIN when only linkedinUrl is provided', async () => {
      transaction.company.findUnique.mockResolvedValue(null);
      transaction.category.findMany.mockResolvedValue([{ id: 1n }]);

      await service.create({
        name: 'LinkedIn Only Co',
        linkedinUrl: 'https://linkedin.com/company/linkedinonly',
      });

      expect(transaction.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recommended_action: 'ENRICH_FROM_LINKEDIN',
            needs_enrichment: true,
          }),
        }),
      );
    });

    it('infers NO_HIRING_PAGE_FOUND when no links are provided', async () => {
      transaction.company.findUnique.mockResolvedValue(null);
      transaction.category.findMany.mockResolvedValue([{ id: 1n }]);

      await service.create({
        name: 'Blank Links Co',
      });

      expect(transaction.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recommended_action: 'NO_HIRING_PAGE_FOUND',
          }),
        }),
      );
    });

    it('rejects empty company name with BadRequestException', async () => {
      await expect(service.create({ name: '   ' })).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  describe('Manual review completion', () => {
    it('clears review flags and recalculates MONITOR_READY when careerUrl is present', async () => {
      transaction.company.findUnique.mockResolvedValue({
        id: 'c-review-1',
        careerUrl: 'https://example.com/careers',
        website_url: 'https://example.com',
      });
      transaction.company.update.mockResolvedValue({
        id: 'c-review-1',
        name: 'Review Co',
        recommended_action: 'MONITOR_READY',
        needs_manual_review: false,
      });

      const result = await service.completeReview('c-review-1');
      expect(result.ok).toBe(true);
      expect(result.recommendedAction).toBe('MONITOR_READY');
      expect(result.needsManualReview).toBe(false);
      expect(transaction.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c-review-1' },
          data: expect.objectContaining({
            needs_manual_review: false,
            review_reasons: null,
            recommended_action: 'MONITOR_READY',
          }),
        }),
      );
    });

    it('recalculates FIND_CAREER_PAGE when only website_url is present', async () => {
      transaction.company.findUnique.mockResolvedValue({
        id: 'c-review-2',
        careerUrl: null,
        website_url: 'https://example.com',
      });
      transaction.company.update.mockResolvedValue({
        id: 'c-review-2',
        name: 'Review Co',
        recommended_action: 'FIND_CAREER_PAGE',
        needs_manual_review: false,
      });

      const result = await service.completeReview('c-review-2');
      expect(result.recommendedAction).toBe('FIND_CAREER_PAGE');
    });

    it('throws NotFoundException for nonexistent company', async () => {
      transaction.company.findUnique.mockResolvedValue(null);
      await expect(service.completeReview('nonexistent')).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('Controlled enrichment', () => {
    it('fetches homepage HTML, extracts career link, and transitions to MONITOR_READY', async () => {
      transaction.company.findUnique.mockResolvedValue({
        id: 'c-enrich-1',
        name: 'Enrichable Co',
        website_url: 'https://enrichable.com',
        careerUrl: null,
        linkedin_url: 'https://linkedin.com/company/enrichable',
      });
      fetcherMock.fetch.mockResolvedValue({
        finalUrl: 'https://enrichable.com/',
        html: '<html><body><nav><a href="/careers">Careers & Openings</a></nav></body></html>',
      });
      transaction.company.update.mockResolvedValue({
        id: 'c-enrich-1',
        name: 'Enrichable Co',
        website_url: 'https://enrichable.com',
        careerUrl: 'https://enrichable.com/careers',
        recommended_action: 'MONITOR_READY',
        needs_enrichment: false,
      });

      const result = await service.enrich('c-enrich-1');
      expect(result.ok).toBe(true);
      expect(result.discoveredFromHtml).toBe(true);
      expect(result.careerUrl).toBe('https://enrichable.com/careers');
      expect(result.recommendedAction).toBe('MONITOR_READY');
      expect(transaction.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            careerUrl: 'https://enrichable.com/careers',
            recommended_action: 'MONITOR_READY',
            needs_enrichment: false,
          }),
        }),
      );
    });

    it('falls back to FIND_CAREER_PAGE if no career link is found in HTML', async () => {
      transaction.company.findUnique.mockResolvedValue({
        id: 'c-enrich-2',
        name: 'Simple Co',
        website_url: 'https://simple.com',
        careerUrl: null,
        linkedin_url: null,
      });
      fetcherMock.fetch.mockResolvedValue({
        finalUrl: 'https://simple.com/',
        html: '<html><body><p>Welcome to simple company.</p></body></html>',
      });
      transaction.company.update.mockResolvedValue({
        id: 'c-enrich-2',
        name: 'Simple Co',
        website_url: 'https://simple.com',
        careerUrl: null,
        recommended_action: 'FIND_CAREER_PAGE',
        needs_enrichment: false,
      });

      const result = await service.enrich('c-enrich-2');
      expect(result.discoveredFromHtml).toBe(false);
      expect(result.recommendedAction).toBe('FIND_CAREER_PAGE');
    });

    it('throws NotFoundException for missing company during enrichment', async () => {
      transaction.company.findUnique.mockResolvedValue(null);
      await expect(service.enrich('nonexistent')).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('Company list filtering', () => {
    it('applies needsManualReview filter to Prisma query', async () => {
      transaction.company.count.mockResolvedValue(1);
      transaction.company.findMany.mockResolvedValue([
        {
          id: 'c-review-1',
          name: 'Flagged Co',
          website_url: null,
          careerUrl: null,
          linkedin_url: null,
          email: null,
          location: null,
          tech_stack: null,
          active: true,
          recommended_action: 'MANUAL_REVIEW',
          needs_manual_review: true,
          review_reasons: 'Source note flag',
          last_checked_at: null,
          categories: [],
        },
      ]);

      const result = await service.list({
        page: 1,
        pageSize: 25,
        needsManualReview: true,
      });

      expect(transaction.company.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            needs_manual_review: true,
          }),
        }),
      );
      expect(result.rows[0].needsManualReview).toBe(true);
      expect(result.rows[0].reviewReasons).toBe('Source note flag');
    });
  });
});
