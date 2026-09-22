import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = readdirSync(join(root, 'migrations'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `migrations/${entry.name}/migration.sql`);

if (process.argv.includes('--update')) {
  const manifest = {};
  for (const file of files) {
    const hash = createHash('sha256')
      .update(readFileSync(join(root, file)))
      .digest('hex');
    manifest[file] = hash;
  }
  writeFileSync(join(root, 'migration-checksums.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Migration integrity manifest updated: ${files.length} artifacts.`);
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(join(root, 'migration-checksums.json'), 'utf8'));
if (JSON.stringify(files.sort()) !== JSON.stringify(Object.keys(manifest).sort())) {
  throw new Error('Migration files and checksum manifest differ; review new or removed artifacts.');
}
for (const file of files) {
  const hash = createHash('sha256')
    .update(readFileSync(join(root, file)))
    .digest('hex');
  if (hash !== manifest[file]) throw new Error(`Migration integrity mismatch: ${file}`);
}
console.log(`Migration integrity passed: ${files.length} artifacts.`);
