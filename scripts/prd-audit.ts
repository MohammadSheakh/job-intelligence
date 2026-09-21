import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures: string[] = [];
const passes: string[] = [];

function read(rel: string): string {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push(`missing file: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function requireFile(rel: string): void {
  if (fs.existsSync(path.join(root, rel))) passes.push(`file ${rel}`);
  else failures.push(`missing file: ${rel}`);
}

function requireText(rel: string, needles: string[]): void {
  const text = read(rel);
  for (const needle of needles) {
    if (text.includes(needle)) passes.push(`${rel}: ${needle}`);
    else failures.push(`${rel} missing required marker: ${needle}`);
  }
}

for (const file of [
  'PRD.md',
  'IMPLEMENTATION_CHECKLIST.md',
  'docs/DATABASE_SWITCHING.md',
  'Dockerfile',
  'compose.yaml',
  'compose.neon.yaml',
  'switch-db.sh',
  'switch-db.cmd',
  'src/ui/ferio.ts',
])
  requireFile(file);

requireText('sql/008_runtime_schema.sql', [
  'candidate_auth',
  'candidate_company_state',
  'candidate_search_runs',
  'company_categories',
]);
requireText('src/portal/routes.ts', [
  '/portal/login',
  '/portal/profile',
  '/portal/quick-search',
  '/portal/company-state',
  '/portal/change-password',
]);
requireText('src/admin/server.ts', [
  '/companies',
  '/categories',
  '/jobs',
  '/candidates',
  '/crawl-logs',
  '/settings',
  'databaseMode',
]);
requireText('compose.yaml', ['DATABASE_MODE: local']);
requireText('compose.neon.yaml', ['DATABASE_MODE: neon']);
requireText('PRD.md', ['NHPF', 'Quick Job Search', 'Ferio', 'Database modes']);
requireText('IMPLEMENTATION_CHECKLIST.md', ['[x]', '[~]', '[ ]']);

const ferio = read('src/ui/ferio.ts').toLowerCase();
for (const prohibited of ['linear-gradient(', 'radial-gradient(', 'backdrop-filter:']) {
  if (ferio.includes(prohibited))
    failures.push(`Ferio layer contains prohibited decorative styling: ${prohibited}`);
  else passes.push(`Ferio layer excludes ${prohibited}`);
}

console.log(`PRD audit: ${passes.length} structural checks passed.`);
if (failures.length) {
  console.error(`PRD audit failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PRD audit status: PASS');
}
