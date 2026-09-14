import 'dotenv/config';
import { closeDb } from '../src/db.js';
import { setSetting } from '../src/repositories/settings.js';

const [key, value] = process.argv.slice(2);
if (!key || value === undefined) {
  throw new Error('Usage: npm run settings:set -- <key> <value>');
}

try {
  await setSetting(key, value);
  console.log(JSON.stringify({ updated: key, value }, null, 2));
} finally {
  await closeDb();
}
