import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve from this file so package-directory invocations check the same tree.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const errors = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const skillRoot = resolve(root, '.agents/skills');
const skills = readdirSync(skillRoot).filter((name) =>
  existsSync(resolve(skillRoot, name, 'SKILL.md')),
);
// Scan every local rule, skill entrypoint, and reference, not a selected subset.
function markdownFiles(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
}
const maintained = [
  'AGENTS.md', 'backend/AGENTS.md', 'frontend/AGENTS.md', 'backend/prisma/AGENTS.md',
  'PRD.md', 'IMPLEMENTATION_CHECKLIST.md', 'docs/ARCHITECTURE_MIGRATION_STATUS.md',
  'docs/agents/instruction-system.md', 'docs/agents/engineering-evidence.md',
  'docs/DATABASE_ARCHITECTURE.md', 'docs/BACKEND_API_CONTRACTS.md',
  'docs/FERIO_PRISMA_REFERENCE.md', ...markdownFiles('.agents'),
];

// Preserve links after fenced examples; closing fences must match the opening
// marker and be at least as long. This is intentionally not a Markdown parser.
function proseOnly(markdown) {
  let fence;
  return markdown.split(/\r?\n/).filter((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length
          && !marker[2].trim()) fence = undefined;
      return false;
    }
    if (marker) { fence = marker[1]; return false; }
    return true;
  }).join('\n');
}

let linkCount = 0;
for (const file of maintained) {
  if (!existsSync(resolve(root, file))) {
    errors.push(`${file}: maintained entrypoint is missing`);
    continue;
  }
  // Deliberately checks inline Markdown links outside fenced examples, not a
  // complete Markdown parser. External URLs and same-file anchors are excluded.
  const content = proseOnly(read(file));
  for (const match of content.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    linkCount++;
    const path = resolve(root, dirname(file), target);
    const local = relative(root, path);
    if (local === '..' || local.startsWith(`..${sep}`)) {
      errors.push(`${file}: nonportable link ${target}`);
    } else if (!existsSync(path)) {
      errors.push(`${file}: missing link ${target}`);
    }
  }
}

for (const name of skills) {
  const path = `.agents/skills/${name}/SKILL.md`;
  const frontmatter = read(path).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) {
    errors.push(`${path}: missing frontmatter`);
    continue;
  }
  // Repository convention uses a simple scalar name and a nonempty description.
  // Full YAML/schema validation remains the skill-authoring tool's responsibility.
  const declared = frontmatter.match(/^name:\s*["']?([a-z\d-]+)["']?\s*$/m)?.[1];
  if (declared !== name) errors.push(`${path}: name must match directory ${name}`);
  if (!/^description:\s*\S.+/m.test(frontmatter)) errors.push(`${path}: missing description`);
  const ui = resolve(root, `.agents/skills/${name}/agents/openai.yaml`);
  if (existsSync(ui) && statSync(ui).isFile()) {
    const prompt = readFileSync(ui, 'utf8').match(/^\s*default_prompt:\s*(.+)$/m)?.[1];
    if (prompt && !new RegExp(`\\$${name}(?![a-z\\d-])`).test(prompt)) {
      errors.push(`${relative(root, ui)}: default_prompt must invoke $${name}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Instruction integrity passed: ${maintained.length} documents, ${linkCount} local links, ${skills.length} skill headers/UI metadata.`);
  console.log('Structural checks only; not a runtime, security, or capacity certification.');
}
