import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const backend = fileURLToPath(new URL('../../', import.meta.url));
const name = `job-intelligence-test-${randomBytes(8).toString('hex')}`;
const password = randomBytes(24).toString('hex');
let started = false;
let child;
const docker = (args, options = {}) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 30_000, ...options });
function cleanup() {
  if (started) {
    docker(['rm', '--force', name], { stdio: 'ignore' });
    started = false;
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    child?.kill(signal);
    try {
      cleanup();
    } finally {
      process.exit(signal === 'SIGINT' ? 130 : 143);
    }
  });
}
try {
  // Never read .env or accept an external database target. No persistent volume.
  docker([
    'run',
    '--detach',
    '--rm',
    '--name',
    name,
    '--tmpfs',
    '/var/lib/postgresql/data',
    '--publish',
    '127.0.0.1::5432',
    '--env',
    'POSTGRES_USER=ji_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--env',
    'POSTGRES_DB=ji_migration_test',
    'postgres:16',
  ]);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      docker(
        ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'ji_test', '-d', 'ji_migration_test'],
        { stdio: 'ignore' },
      );
      ready = true;
      break;
    } catch {
      await setTimeout(500);
    }
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready.');
  for (const file of ['001_init.sql', '008_runtime_schema.sql']) {
    const sql = readFileSync(new URL(`../../../sql/${file}`, import.meta.url), 'utf8');
    docker(
      [
        'exec',
        '-i',
        name,
        'psql',
        '-U',
        'ji_test',
        '-d',
        'ji_migration_test',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: sql, stdio: ['pipe', 'ignore', 'pipe'] },
    );
  }
  const port = docker(['port', name, '5432/tcp']).trim().split(':').at(-1);
  if (!/^\d+$/.test(port)) throw new Error('Could not determine local PostgreSQL port.');
  console.log(
    `Running ${process.argv.includes('--browser') ? 'browser' : 'API'} tests against disposable local PostgreSQL 16.`,
  );
  const status = await new Promise((resolve, reject) => {
    child = spawn(
      process.execPath,
      [
        'node_modules/jest/bin/jest.js',
        '--config',
        process.argv.includes('--browser') ? 'jest.browser.config.cjs' : 'jest.database.config.cjs',
        '--runInBand',
      ],
      {
        cwd: backend,
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL: `postgresql://ji_test:${password}@127.0.0.1:${port}/ji_migration_test`,
          JI_DISPOSABLE_DATABASE: 'true',
          CANDIDATE_SESSION_SECRET: randomBytes(32).toString('hex'),
          COOKIE_SECURE: 'false',
        },
      },
    );
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = status;
} finally {
  cleanup();
}
