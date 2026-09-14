import type { CandidateForMatch, JobForMatch, MatchResult } from '../matching/types.js';
import type { SystemSettings } from '../repositories/settings.js';

let aiCallsThisRun = 0;

interface AiMatchResponse {
  semanticScore: number;
  reason?: string;
}

export async function maybeEnhanceMatch(
  settings: SystemSettings,
  candidate: CandidateForMatch,
  job: JobForMatch,
  base: MatchResult,
): Promise<MatchResult> {
  if (!base.eligible || !settings.aiEnabled || !settings.aiMatchingEnabled) return base;
  if (settings.aiDailyLimit <= 0 || aiCallsThisRun >= settings.aiDailyLimit) return base;

  const baseUrl = process.env.AI_BASE_URL?.replace(/\/$/, '');
  const model = process.env.AI_MODEL;
  if (!baseUrl || !model) return base;

  try {
    aiCallsThisRun += 1;
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
            content: 'Return JSON only: {"semanticScore":0-100,"reason":"short explanation"}. Score candidate-job career fit. Do not override explicit location/work-mode exclusions.',
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

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return base;
    const parsed = JSON.parse(content) as AiMatchResponse;
    if (!Number.isFinite(parsed.semanticScore)) return base;

    const semanticScore = Math.max(0, Math.min(100, Math.round(parsed.semanticScore)));
    const finalScore = Math.round(base.deterministicScore * 0.8 + semanticScore * 0.2);
    return {
      ...base,
      finalScore,
      aiUsed: true,
      reasons: parsed.reason ? [...base.reasons, `AI: ${parsed.reason}`] : base.reasons,
    };
  } catch {
    return base;
  }
}
