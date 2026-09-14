import 'dotenv/config';
import { closeDb, db } from '../src/db.js';
import { setCandidatePassword } from '../src/auth/candidate-auth.js';
import { env } from '../src/config/env.js';

const emailIndex = process.argv.indexOf('--email');
const email = emailIndex >= 0 ? process.argv[emailIndex + 1] : undefined;
if (!email) throw new Error('Usage: npm run candidate:set-default-password -- --email user@example.com');

try {
  const result = await db.query<{id:string|number}>('SELECT id FROM candidates WHERE lower(email)=lower($1) LIMIT 1',[email]);
  if (!result.rows[0]) throw new Error('Candidate not found.');
  await setCandidatePassword(Number(result.rows[0].id),env.defaultCandidatePassword,{mustChange:true});
  console.log(`Default password initialized for ${email}. Candidate must change it after login.`);
} finally {
  await closeDb();
}
