import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Fault injection exercises the shipped checker in a disposable copy. All edits
// are under the copied .agents directory; linked project files are read-only inputs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = mkdtempSync(join(tmpdir(), 'instruction-integrity-'));
try {
  cpSync(join(root, '.agents'), join(fixture, '.agents'), { recursive: true });
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (['.agents', '.git', 'node_modules'].includes(entry.name) || entry.name.startsWith('.env')) continue;
    symlinkSync(join(root, entry.name), join(fixture, entry.name), entry.isDirectory() ? 'junction' : 'file');
  }
  const run = () => spawnSync(process.execPath, [join(fixture, '.agents/scripts/check-instructions.mjs')], {
    cwd: fixture, encoding: 'utf8', timeout: 10_000,
  });
  const baseline = run();
  assert.equal(baseline.status, 0, baseline.stderr);
  const cases = [
    ['.agents/README.md', (s) => `${s}\n[broken](missing-file.md)\n`, 'missing link'],
    ['.agents/skills/tdd/SKILL.md', (s) => s.replace('name: tdd', 'name: wrong-name'), 'name must match'],
    ['.agents/skills/job-intelligence-backend/agents/openai.yaml',
      (s) => s.replace('$job-intelligence-backend', '$obsolete-skill'), 'default_prompt must invoke'],
    ['.agents/skills/owasp-security/references/web-security.md',
      (s) => `${s}\n~~~md\n[example](ignored.md)\n~~~\n[broken](missing-reference.md)\n`, 'missing-reference.md'],
  ];
  for (const [file, mutate, expected] of cases) {
    const path = join(fixture, file);
    const original = readFileSync(path, 'utf8');
    try {
      writeFileSync(path, mutate(original));
      const result = run();
      assert.equal(result.status, 1, `${file}: ${result.stderr}`);
      assert.ok(result.stderr.includes(expected), result.stderr);
      assert.ok(!result.stderr.includes('ignored.md'), 'Fenced examples must be excluded');
    } finally {
      writeFileSync(path, original);
    }
  }
  // New references must be discovered without editing an allowlist.
  writeFileSync(join(fixture, '.agents/new-reference.md'), '[broken](new-missing.md)\n');
  assert.ok(run().stderr.includes('new-missing.md'));
  console.log('Checker verified: baseline passes; five structural regressions fail. No application tests or database access.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
