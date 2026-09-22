import 'reflect-metadata';
import { AiMatchEnhancerService } from '../../src/features/matching/services/ai-match-enhancer.service.js';
import type { SettingsService } from '../../src/features/settings/services/settings.service.js';
import type {
  CandidateForMatch,
  JobForMatch,
  MatchResult,
} from '../../src/features/matching/domain/types.js';

describe('AiMatchEnhancerService', () => {
  let service: AiMatchEnhancerService;
  let mockSettings: jest.Mocked<SettingsService>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockSettings = {
      get: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<SettingsService>;
    service = new AiMatchEnhancerService(mockSettings);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isAvailable', () => {
    it('returns false when aiEnabled is false', async () => {
      process.env.AI_BASE_URL = 'https://api.openai.com/v1';
      process.env.AI_MODEL = 'gpt-4o-mini';
      mockSettings.get.mockResolvedValue({
        aiEnabled: false,
        aiMatchingEnabled: true,
        aiDailyLimit: 15,
        aiProvider: 'openai',
        aiSkillExtractionEnabled: false,
        defaultMatchThreshold: 70,
        emailEnabled: false,
        quickSearchDailyLimit: 3,
        quickSearchAiDailyLimit: 1,
        quickSearchCompanyLimit: 8,
      });

      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it('returns false when AI_MODEL is missing', async () => {
      process.env.AI_BASE_URL = 'https://api.openai.com/v1';
      delete process.env.AI_MODEL;
      mockSettings.get.mockResolvedValue({
        aiEnabled: true,
        aiMatchingEnabled: true,
        aiDailyLimit: 15,
        aiProvider: 'openai',
        aiSkillExtractionEnabled: false,
        defaultMatchThreshold: 70,
        emailEnabled: false,
        quickSearchDailyLimit: 3,
        quickSearchAiDailyLimit: 1,
        quickSearchCompanyLimit: 8,
      });

      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it('returns true when fully configured and enabled', async () => {
      process.env.AI_BASE_URL = 'https://api.openai.com/v1';
      process.env.AI_MODEL = 'gpt-4o-mini';
      mockSettings.get.mockResolvedValue({
        aiEnabled: true,
        aiMatchingEnabled: true,
        aiDailyLimit: 15,
        aiProvider: 'openai',
        aiSkillExtractionEnabled: false,
        defaultMatchThreshold: 70,
        emailEnabled: false,
        quickSearchDailyLimit: 3,
        quickSearchAiDailyLimit: 1,
        quickSearchCompanyLimit: 8,
      });

      const available = await service.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('enhance', () => {
    const candidate: CandidateForMatch = {
      expertise: 'Fullstack Engineer',
      skills: 'TypeScript, Node.js, PostgreSQL',
      experienceLevel: 'Senior',
    };

    const job: JobForMatch = {
      title: 'Senior TypeScript Developer',
      description: 'Looking for a senior engineer with Node.js and Postgres experience.',
      skills: 'TypeScript, Node.js',
    };

    const baseResult: MatchResult = {
      eligible: true,
      deterministicScore: 75,
      finalScore: 75,
      breakdown: { expertise: 30, skills: 45 },
      matchedSkills: ['TypeScript', 'Node.js'],
      matchedCompanyCategories: [],
      matchedPreferredCategories: [],
      reasons: ['Role match: Fullstack Engineer', 'Skill match: TypeScript'],
      aiUsed: false,
    };

    it('returns base score unmodified when quota limit is reached (15 calls)', async () => {
      mockSettings.get.mockResolvedValue({
        aiEnabled: true,
        aiMatchingEnabled: true,
        aiDailyLimit: 15,
        aiProvider: 'openai',
        aiSkillExtractionEnabled: false,
        defaultMatchThreshold: 70,
        emailEnabled: false,
        quickSearchDailyLimit: 3,
        quickSearchAiDailyLimit: 1,
        quickSearchCompanyLimit: 8,
      });

      const limitState = { callsMade: 15 };
      const enhanced = await service.enhance(candidate, job, baseResult, limitState);

      expect(enhanced.finalScore).toBe(75);
      expect(enhanced.aiUsed).toBe(false);
      expect(limitState.callsMade).toBe(15);
    });

    it('blends deterministic score and AI semantic score on valid AI response', async () => {
      process.env.AI_BASE_URL = 'https://api.openai.com/v1';
      process.env.AI_MODEL = 'gpt-4o-mini';
      process.env.AI_API_KEY = 'sk-test';

      mockSettings.get.mockResolvedValue({
        aiEnabled: true,
        aiMatchingEnabled: true,
        aiDailyLimit: 15,
        aiProvider: 'openai',
        aiSkillExtractionEnabled: false,
        defaultMatchThreshold: 70,
        emailEnabled: false,
        quickSearchDailyLimit: 3,
        quickSearchAiDailyLimit: 1,
        quickSearchCompanyLimit: 8,
      });

      const fakeFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  semanticScore: 90,
                  reason: 'Strong architectural alignment with candidate experience',
                }),
              },
            },
          ],
        }),
      });
      global.fetch = fakeFetch;

      const limitState = { callsMade: 0 };
      const enhanced = await service.enhance(candidate, job, baseResult, limitState);

      expect(limitState.callsMade).toBe(1);
      // Blended: round(75 * 0.8 + 90 * 0.2) = round(60 + 18) = 78
      expect(enhanced.finalScore).toBe(78);
      expect(enhanced.aiUsed).toBe(true);
      expect(enhanced.reasons).toContain(
        'AI: Strong architectural alignment with candidate experience',
      );
    });

    it('gracefully falls back to base score on API network error', async () => {
      process.env.AI_BASE_URL = 'https://api.openai.com/v1';
      process.env.AI_MODEL = 'gpt-4o-mini';

      mockSettings.get.mockResolvedValue({
        aiEnabled: true,
        aiMatchingEnabled: true,
        aiDailyLimit: 15,
        aiProvider: 'openai',
        aiSkillExtractionEnabled: false,
        defaultMatchThreshold: 70,
        emailEnabled: false,
        quickSearchDailyLimit: 3,
        quickSearchAiDailyLimit: 1,
        quickSearchCompanyLimit: 8,
      });

      const fakeFetch = jest.fn().mockRejectedValue(new Error('Network connection timeout'));
      global.fetch = fakeFetch;

      const limitState = { callsMade: 0 };
      const enhanced = await service.enhance(candidate, job, baseResult, limitState);

      expect(limitState.callsMade).toBe(1);
      expect(enhanced.finalScore).toBe(75);
      expect(enhanced.aiUsed).toBe(false);
    });
  });
});
