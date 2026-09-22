import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/database';
import { AppConfigService } from '../../src/config/config.service';
import { AdminCandidatesService } from '../../src/features/admin-operations/services/admin-candidates.service';
import { CandidateAuthenticationService } from '../../src/features/authentication/services/candidate-authentication.service';
import { CandidateProfileService } from '../../src/features/candidate-portal/services/candidate-profile.service';
import { deterministicMatch } from '../../src/features/matching/domain/matcher';

describe('Admin Candidates, Experience Levels/Years, and Candidate Profile', () => {
  describe('AdminCandidatesService with controlled levels and numeric experience years', () => {
    let module: TestingModule;
    let service: AdminCandidatesService;

    const prismaMock = {
      candidate: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      candidateAuth: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const authServiceMock = {
      setPassword: jest.fn(),
    };

    const configServiceMock = {
      app: {
        defaultCandidatePassword: 'DefaultPassword123!',
      },
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      prismaMock.$transaction.mockImplementation(async (work) =>
        typeof work === 'function' ? work(prismaMock) : Promise.all(work),
      );

      module = await Test.createTestingModule({
        providers: [
          AdminCandidatesService,
          { provide: PrismaService, useValue: prismaMock },
          { provide: CandidateAuthenticationService, useValue: authServiceMock },
          { provide: AppConfigService, useValue: configServiceMock },
        ],
      }).compile();

      service = module.get(AdminCandidatesService);
    });

    afterEach(async () => module.close());

    it('lists candidates with experienceLevel and experienceYears projections', async () => {
      prismaMock.candidate.findMany.mockResolvedValue([
        {
          id: 10n,
          name: 'Sarah Chen',
          email: 'sarah@example.com',
          expertise: 'Staff Engineer',
          skills: 'TypeScript, NestJS',
          experience_level: 'Lead/Principal',
          experience_years: 8,
          preferred_locations: 'Remote',
          excluded_locations: null,
          preferred_work_modes: 'Remote',
          preferred_categories: 'TypeScript',
          excluded_categories: null,
          minimum_match_score: 75,
          active: true,
          auth: { passwordHash: 'hash', google_sub: null },
        },
      ]);

      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '10',
        name: 'Sarah Chen',
        experienceLevel: 'Lead/Principal',
        experienceYears: 8,
        hasPassword: true,
        hasGoogle: false,
      });
    });

    it('creates candidate persisting controlled level and experience years', async () => {
      prismaMock.candidate.create.mockResolvedValue({ id: 15n });

      const result = await service.create({
        name: 'Alex Rivera',
        email: 'alex@example.com',
        expertise: 'Backend Developer',
        skills: 'PostgreSQL, Node.js',
        experienceLevel: 'Mid',
        experienceYears: 3,
        preferredCategories: ['Node.js'],
        excludedCategories: [],
        minimumMatchScore: 70,
        active: true,
        newPassword: 'SecurePassword123!',
      });

      expect(result).toEqual({ id: '15' });
      expect(prismaMock.candidate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Alex Rivera',
            email: 'alex@example.com',
            experience_level: 'Mid',
            experience_years: 3,
            active: true,
          }),
        }),
      );
      expect(authServiceMock.setPassword).toHaveBeenCalledWith(
        15n,
        'SecurePassword123!',
        true,
        expect.anything(),
      );
    });

    it('updates candidate with experience years and controlled level', async () => {
      prismaMock.candidate.updateMany.mockResolvedValue({ count: 1 });

      await service.update('15', {
        name: 'Alex Rivera',
        email: 'alex@example.com',
        experienceLevel: 'Senior',
        experienceYears: 5,
        preferredCategories: ['Node.js'],
        excludedCategories: [],
        minimumMatchScore: 75,
        active: true,
      });

      expect(prismaMock.candidate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 15n },
          data: expect.objectContaining({
            experience_level: 'Senior',
            experience_years: 5,
          }),
        }),
      );
    });
  });

  describe('CandidateProfileService with experienceYears', () => {
    let module: TestingModule;
    let service: CandidateProfileService;

    const prismaMock = {
      candidate: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
      },
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      prismaMock.category.findMany.mockResolvedValue([{ name: 'TypeScript' }]);

      module = await Test.createTestingModule({
        providers: [CandidateProfileService, { provide: PrismaService, useValue: prismaMock }],
      }).compile();

      service = module.get(CandidateProfileService);
    });

    afterEach(async () => module.close());

    it('gets profile including experience_years', async () => {
      prismaMock.candidate.findFirst.mockResolvedValue({
        name: 'Jordan',
        email: 'jordan@example.com',
        expertise: 'Full Stack',
        skills: 'React, Node',
        experience_level: 'Junior',
        experience_years: 1,
        preferred_locations: 'Dhaka',
        excluded_locations: null,
        preferred_work_modes: 'Hybrid',
        preferred_categories: 'TypeScript',
        excluded_categories: null,
        minimum_match_score: 65,
      });

      const profile = await service.get(42n);
      expect(profile.experience_years).toBe(1);
      expect(profile.experience_level).toBe('Junior');
    });

    it('updates profile saving experience_years and controlled level', async () => {
      prismaMock.candidate.updateMany.mockResolvedValue({ count: 1 });

      await service.update(42n, {
        name: 'Jordan Smith',
        experienceLevel: 'Mid',
        experienceYears: 3,
        minimumMatchScore: 70,
        preferredCategories: ['TypeScript'],
      });

      expect(prismaMock.candidate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 42n, active: true },
          data: expect.objectContaining({
            name: 'Jordan Smith',
            experience_level: 'Mid',
            experience_years: 3,
          }),
        }),
      );
    });
  });

  describe('Matcher: controlled experience levels & numeric years evaluation', () => {
    it('evaluates controlled level compatibility', () => {
      const match = deterministicMatch(
        {
          expertise: 'Backend',
          skills: 'TypeScript, PostgreSQL',
          experienceLevel: 'Senior',
        },
        {
          title: 'Senior Backend Developer',
          experience: 'Senior Level',
          skills: 'TypeScript, PostgreSQL',
        },
      );

      expect(match.eligible).toBe(true);
      expect(match.breakdown.experience).toBe(100);
      expect(match.reasons).toContain('Experience level is compatible');
    });

    it('rewards compatible numeric experience years', () => {
      const match = deterministicMatch(
        {
          expertise: 'Backend',
          skills: 'TypeScript',
          experienceLevel: 'Mid',
          experienceYears: 4,
        },
        {
          title: 'Software Engineer',
          experience: '3+ years of experience with backend systems',
          skills: 'TypeScript',
        },
      );

      expect(match.eligible).toBe(true);
      // Mid rank vs Mid (no explicit level in jobText other than 3+ years) -> numeric year match = 100
      expect(match.breakdown.experience).toBeGreaterThanOrEqual(80);
    });

    it('adjusts score when candidate experience years are significantly below requirement', () => {
      const match = deterministicMatch(
        {
          expertise: 'Backend',
          skills: 'TypeScript',
          experienceLevel: 'Junior',
          experienceYears: 1,
        },
        {
          title: 'Senior Software Engineer',
          experience: '5+ years required',
          skills: 'TypeScript',
        },
      );

      // Junior (rank 2) vs Senior (rank 4) diff = 2 -> levelScore 20; 1 year vs 5+ -> yearScore 30; blend = 25
      expect(match.breakdown.experience).toBeLessThanOrEqual(30);
    });
  });
});
