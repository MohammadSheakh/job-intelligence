import { maybeEnhanceMatch } from '../ai/match-enhancer.js';
import { deterministicMatch } from './matcher.js';
import { getActiveCandidates } from '../repositories/candidates.js';
import { getOpenJobsForMatching } from '../repositories/jobs.js';
import { getNotifiedPairSet } from '../repositories/notifications.js';
import { getSettings } from '../repositories/settings.js';
import { getBlacklistedPairSet } from '../repositories/candidate-company-tracking.js';
import type { CandidateForMatch, JobForMatch, MatchResult } from './types.js';

export interface QualifyingMatch {
  candidate: CandidateForMatch;
  job: JobForMatch;
  threshold: number;
  result: MatchResult;
}

export async function findQualifyingMatches(): Promise<{
  aiEnabled: boolean;
  aiMatchingEnabled: boolean;
  candidateCount: number;
  openJobCount: number;
  matches: QualifyingMatch[];
}> {
  const [settings, candidates, jobs, notified, blacklisted] = await Promise.all([
    getSettings(),
    getActiveCandidates(),
    getOpenJobsForMatching(),
    getNotifiedPairSet(),
    getBlacklistedPairSet(),
  ]);

  const matches: QualifyingMatch[] = [];
  for (const candidate of candidates) {
    for (const job of jobs) {
      if (notified.has(`${candidate.id}:${job.id}`)) continue;
      if (blacklisted.has(`${candidate.id}:${job.companyId}`)) continue;
      const base = deterministicMatch(candidate, job);
      if (!base.eligible) continue;
      const result = await maybeEnhanceMatch(settings, candidate, job, base);
      const threshold = candidate.minimumMatchScore ?? settings.defaultMatchThreshold;
      if (result.finalScore < threshold) continue;
      matches.push({ candidate, job, threshold, result });
    }
  }

  matches.sort((a, b) => b.result.finalScore - a.result.finalScore);
  return {
    aiEnabled: settings.aiEnabled,
    aiMatchingEnabled: settings.aiMatchingEnabled,
    candidateCount: candidates.length,
    openJobCount: jobs.length,
    matches,
  };
}
