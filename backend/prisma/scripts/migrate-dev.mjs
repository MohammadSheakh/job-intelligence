import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

// 1. Build unified schema from modular fragments
const buildResult = spawnSync('node', [join(root, 'build-prisma-schemaV2.js')], {
  stdio: 'inherit',
});
if (buildResult.status !== 0) process.exit(buildResult.status ?? 1);

// 2. Run prisma migrate dev with any arguments passed by caller (e.g. --name, --create-only)
const userArgs = process.argv.slice(2);
const migrateResult = spawnSync(
  'pnpm',
  ['prisma', 'migrate', 'dev', '--schema', 'prisma/schema.prisma', ...userArgs],
  {
    stdio: 'inherit',
  },
);
if (migrateResult.status !== 0) process.exit(migrateResult.status ?? 1);

// 3. Keep migration checksum manifest automatically in sync
const updateResult = spawnSync('node', [join(root, 'check-migrations.mjs'), '--update'], {
  stdio: 'inherit',
});
if (updateResult.status !== 0) process.exit(updateResult.status ?? 1);
