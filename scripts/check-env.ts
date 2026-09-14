import 'dotenv/config';
import { environmentProblems, env } from '../src/config/env.js';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))?.slice('--mode='.length);
const mode = modeArg === 'worker' || modeArg === 'server' ? modeArg : 'all';
const problems = environmentProblems(mode);

console.log(`Environment check (${mode})`);
console.log(`- DATABASE_URL: ${env.databaseUrl ? 'set' : 'missing'}`);
console.log(`- Admin credentials: ${env.adminUsername && env.adminPassword ? 'set' : 'incomplete'}`);
console.log(`- Candidate session secret: ${env.candidateSessionSecret ? 'set' : 'missing'}`);
console.log(`- Default candidate password: ${env.defaultCandidatePassword ? 'set' : 'missing'}`);
console.log(`- Google OAuth: ${env.googleClientId && env.googleClientSecret ? 'configured' : 'off'}`);
console.log(`- AI provider env: ${env.aiModel ? 'configured' : 'off/local optional'}`);
console.log(`- SMTP env: ${env.smtpUser && env.smtpPass ? 'configured' : 'off'}`);

if (problems.length) {
  console.error('\nProblems:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('\nEnvironment looks valid for the selected mode.');
}
