import 'dotenv/config';
import { closeDb } from '../src/db.js';
import { findQualifyingMatches } from '../src/matching/find-matches.js';

try {
  const result = await findQualifyingMatches();
  console.log(JSON.stringify({
    aiEnabled: result.aiEnabled,
    aiMatchingEnabled: result.aiMatchingEnabled,
    candidateCount: result.candidateCount,
    openJobCount: result.openJobCount,
    qualifyingMatchCount: result.matches.length,
    matches: result.matches.map(({ candidate, job, threshold, result: match }) => ({
      candidate: { id: candidate.id, name: candidate.name, email: candidate.email },
      job: {
        id: job.id,
        title: job.title,
        company: job.companyName,
        location: job.location ?? job.companyLocation,
        applicationUrl: job.applicationUrl,
        companyCategories: job.companyCategories,
      },
      threshold,
      ...match,
    })),
  }, null, 2));
} finally {
  await closeDb();
}
