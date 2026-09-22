import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/database';
import { CandidateCompanyService } from '../../src/features/candidate-portal/services/candidate-company.service';
import { CandidateTrackingFilter } from '../../src/features/candidate-portal/dto/candidate-company-query.dto';

describe('CandidateCompanyService', () => {
  let module: TestingModule;
  let service: CandidateCompanyService;

  const prisma = {
    company: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (work) => Promise.all(work)),
  };

  const sampleCompany = {
    id: 'comp-alpha',
    name: 'Alpha Software',
    website_url: 'https://alpha.example',
    careerUrl: 'https://alpha.example/careers',
    location: 'Dhaka, Bangladesh',
    categories: [{ category: { name: 'Engineering' } }, { category: { name: 'Other' } }],
    candidate_company_state: [
      {
        status: 'PLANNING',
        last_applied_at: new Date('2026-09-01T00:00:00.000Z'),
        reapply_count: 1,
        notes: 'Targeting Q4 opening',
      },
    ],
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (work) => Promise.all(work));
    prisma.company.count.mockResolvedValue(1);
    prisma.company.findMany.mockResolvedValue([sampleCompany]);

    module = await Test.createTestingModule({
      providers: [
        CandidateCompanyService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(CandidateCompanyService);
  });

  afterEach(async () => module.close());

  it('returns flat array when page is omitted (backwards compatibility)', async () => {
    const result = await service.list(101n, { limit: 10 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    if (!Array.isArray(result)) throw new Error('Expected legacy array response');
    expect(result[0]).toEqual({
      id: 'comp-alpha',
      name: 'Alpha Software',
      websiteUrl: 'https://alpha.example',
      careerUrl: 'https://alpha.example/careers',
      location: 'Dhaka, Bangladesh',
      categories: ['Engineering'],
      trackingStatus: 'PLANNING',
      lastAppliedAt: '2026-09-01',
      reapplyCount: 1,
      notes: 'Targeting Q4 opening',
    });
  });

  it('returns paginated response structure when page is provided', async () => {
    prisma.company.count.mockResolvedValue(55);
    const result = await service.list(101n, { page: 2, pageSize: 25 });
    expect(result).toEqual({
      total: 55,
      page: 2,
      pageSize: 25,
      totalPages: 3,
      rows: expect.arrayContaining([
        expect.objectContaining({
          id: 'comp-alpha',
          name: 'Alpha Software',
          trackingStatus: 'PLANNING',
        }),
      ]),
    });
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('filters by search q across name, location, and tech_stack', async () => {
    await service.list(101n, { page: 1, pageSize: 25, q: 'Node.js' });
    expect(prisma.company.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        active: true,
        OR: [
          { name: { contains: 'Node.js', mode: 'insensitive' } },
          { location: { contains: 'Node.js', mode: 'insensitive' } },
          { tech_stack: { contains: 'Node.js', mode: 'insensitive' } },
        ],
      }),
    });
  });

  it('filters by location and category', async () => {
    await service.list(101n, {
      page: 1,
      pageSize: 25,
      location: 'Dhaka',
      category: 'Fintech',
    });
    expect(prisma.company.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        location: { contains: 'Dhaka', mode: 'insensitive' },
        categories: { some: { category: { name: 'Fintech' } } },
      }),
    });
  });

  it('filters by candidate tracking status: PLANNING, APPLIED, EXCLUDED', async () => {
    await service.list(101n, {
      page: 1,
      pageSize: 25,
      status: CandidateTrackingFilter.APPLIED,
    });
    expect(prisma.company.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        candidate_company_state: {
          some: { candidate_id: 101n, status: CandidateTrackingFilter.APPLIED },
        },
      }),
    });
  });

  it('filters by candidate tracking status: UNTRACKED', async () => {
    await service.list(101n, {
      page: 1,
      pageSize: 25,
      status: CandidateTrackingFilter.UNTRACKED,
    });
    expect(prisma.company.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        candidate_company_state: {
          none: { candidate_id: 101n },
        },
      }),
    });
  });
});
