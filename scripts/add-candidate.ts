import 'dotenv/config';
import { closeDb } from '../src/db.js';
import { upsertCandidate } from '../src/repositories/candidates.js';
import { ensureCandidateDefaultPassword } from '../src/auth/candidate-auth.js';

function args(): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace(/^--/, '');
    const value = process.argv[i + 1];
    if (key && value !== undefined) map.set(key, value);
  }
  return map;
}

const a = args();
const name = a.get('name');
const email = a.get('email');
if (!name || !email) {
  throw new Error(
    'Usage: npm run candidate:add -- --name "Name" --email "email@example.com" [--expertise "Backend Developer"] [--skills "Node.js,PostgreSQL"] [--preferred-locations "Gulshan,Badda"] [--excluded-locations "Uttara"] [--work-modes "Remote,Hybrid"] [--experience "mid"] [--preferred-categories "Backend,Node.js"] [--excluded-categories "NGO/Development"] [--threshold "70"]',
  );
}

try {
  const id = await upsertCandidate({
    name,
    email,
    expertise: a.get('expertise'),
    skills: a.get('skills'),
    experienceLevel: a.get('experience'),
    preferredLocations: a.get('preferred-locations'),
    excludedLocations: a.get('excluded-locations'),
    preferredWorkModes: a.get('work-modes'),
    preferredCategories: a.get('preferred-categories'),
    excludedCategories: a.get('excluded-categories'),
    minimumMatchScore: a.get('threshold') ? Number(a.get('threshold')) : undefined,
  });
  await ensureCandidateDefaultPassword(id);
  console.log(
    JSON.stringify(
      { candidateId: id, email, defaultPasswordAssignedIfMissing: true, mustChangePassword: true },
      null,
      2,
    ),
  );
} finally {
  await closeDb();
}
