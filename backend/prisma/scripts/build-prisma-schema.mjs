import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const schemaRoot = join(process.cwd(), 'prisma', 'schema');
const output = join(process.cwd(), 'prisma', 'schema.prisma');
const base = ['base/generator.prisma', 'base/datasource.prisma'];
const entries = await readdir(schemaRoot, { withFileTypes: true });
const modules = entries
  .filter((entry) => entry.isDirectory() && entry.name !== 'base')
  .flatMap((entry) => entry.name);
const files = [
  ...base,
  ...modules.map(
    (name) =>
      `${name}/${name === 'company-intelligence.module' ? 'company' : name === 'job-crawling.module' ? 'job' : name === 'candidate-portal.module' ? 'candidate' : name === 'settings.module' ? 'settings' : 'notification'}.prisma`,
  ),
];
await writeFile(
  output,
  `${(await Promise.all(files.map((file) => readFile(join(schemaRoot, file), 'utf8')))).join('\n\n')}\n`,
);
