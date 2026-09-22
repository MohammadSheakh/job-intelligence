import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/services/settings.service.js';
import type { CandidateForMatch, JobForMatch, MatchResult } from '../domain/types.js';

interface AiMatchResponse {
  semanticScore?: number;
  reason?: string;
}

/**
 * Provides optional AI-assisted semantic score enhancement for eligible candidate-job matches.
 * Hard exclusions always win: only deterministically eligible jobs may receive AI scoring.
 */
@Injectable()
export class AiMatchEnhancerService {
  private readonly logger = new Logger(AiMatchEnhancerService.name);

  constructor(private readonly settings: SettingsService) {}

  /** Check whether AI matching is enabled in settings and configured via environment variables. */
  async isAvailable(): Promise<boolean> {
    const s = await this.settings.get();
    const baseUrl = process.env.AI_BASE_URL?.trim();
    const model = process.env.AI_MODEL?.trim();
    return Boolean(s.aiEnabled && s.aiMatchingEnabled && s.aiDailyLimit > 0 && baseUrl && model);
  }

  /**
   * Optionally enhance an eligible match with semantic scoring. Degrades gracefully
   * to the deterministic score if the provider is unavailable, times out, or fails.
   */
  async enhance(
    candidate: CandidateForMatch,
    job: JobForMatch,
    base: MatchResult,
    limitState: { callsMade: number },
  ): Promise<MatchResult> {
    if (!base.eligible) return base;

    const s = await this.settings.get();
    if (!s.aiEnabled || !s.aiMatchingEnabled || s.aiDailyLimit <= 0) return base;
    if (limitState.callsMade >= s.aiDailyLimit) return base;

    const baseUrl = process.env.AI_BASE_URL?.trim().replace(/\/$/, '');
    const model = process.env.AI_MODEL?.trim();
    if (!baseUrl || !model) return base;

    try {
      limitState.callsMade += 1;
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.AI_API_KEY ? { authorization: `Bearer ${process.env.AI_API_KEY}` } : {}),
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Return JSON only: {"semanticScore":0-100,"reason":"short explanation"}. Score candidate-job career fit. Do not override explicit location/work-mode exclusions.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                candidate: {
                  expertise: candidate.expertise,
                  skills: candidate.skills,
                  experienceLevel: candidate.experienceLevel,
                  preferredCategories: candidate.preferredCategories,
                  excludedCategories: candidate.excludedCategories,
                },
                job: {
                  title: job.title,
                  description: job.description,
                  skills: job.skills,
                  experience: job.experience,
                  companyTechStack: job.companyTechStack,
                  companyCategories: job.companyCategories,
                  companySectorCategories: job.companySectorCategories,
                },
                deterministicScore: base.deterministicScore,
              }),
            },
          ],
        }),
      });

      if (!response.ok) return base;

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return base;

      const parsed = JSON.parse(content) as AiMatchResponse;
      if (typeof parsed.semanticScore !== 'number' || !Number.isFinite(parsed.semanticScore)) {
        return base;
      }

      const semanticScore = Math.max(0, Math.min(100, Math.round(parsed.semanticScore)));
      const finalScore = Math.round(base.deterministicScore * 0.8 + semanticScore * 0.2);

      return {
        ...base,
        finalScore,
        aiUsed: true,
        reasons: parsed.reason ? [...base.reasons, `AI: ${parsed.reason}`] : base.reasons,
      };
    } catch (error) {
      this.logger.warn({
        message: 'AI match enhancement failed; falling back to deterministic score.',
        error: error instanceof Error ? error.message : String(error),
      });
      return base;
    }
  }
}
