import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { loadCatalog } from './seeds/catalog';

config({ path: resolve(__dirname, '../../.env') });

/** Preview by default. Apply uses SEED_DATABASE_URL if provided, falling back to DATABASE_URL. */
async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  if (
    args.some((arg) => !['--apply', '--dry-run'].includes(arg)) ||
    (args.includes('--apply') && args.includes('--dry-run'))
  ) {
    throw new Error('Usage: prisma:seed [--dry-run | --apply]');
  }
  const catalog = loadCatalog();
  console.log(
    JSON.stringify({
      mode: args.includes('--apply') ? 'apply' : 'preview',
      companies: catalog.companies.length,
      categories: catalog.categories.length,
      assignments: catalog.assignments.length,
      fingerprints: catalog.fingerprints,
    }),
  );
  if (!args.includes('--apply')) return;
  const target = process.env.SEED_DATABASE_URL || process.env.DATABASE_URL;
  if (!target)
    throw new Error(
      'Apply requires a configured database target (SEED_DATABASE_URL or DATABASE_URL).',
    );
  // Reject malformed URLs without echoing credentials in parser errors.
  try {
    const url = new URL(target);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error('Invalid seed database target.');
  }
  const pool = new Pool({ connectionString: target, max: 1, connectionTimeoutMillis: 5000 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const summary = await prisma.$transaction(
      async (tx) => {
        // Serialize this seed workflow; unique constraints also protect overlapping inserts.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(124631, 2)`;
        let companyCount = 0;
        for (let i = 0; i < catalog.companies.length; i += 100) {
          companyCount += (
            await tx.company.createMany({
              data: catalog.companies.slice(i, i + 100),
              skipDuplicates: true,
            })
          ).count;
        }
        const categories = await tx.category.createMany({
          data: catalog.categories,
          skipDuplicates: true,
        });
        const categoryRows = await tx.category.findMany({
          where: { name: { in: catalog.categories.map((item) => item.name) } },
          select: { id: true, name: true },
        });
        const categoryIds = new Map(categoryRows.map((row) => [row.name, row.id]));
        let assignmentCount = 0;
        for (let i = 0; i < catalog.assignments.length; i += 100) {
          const data = catalog.assignments.slice(i, i + 100).map((item) => ({
            companyId: item.companyId,
            categoryId: categoryIds.get(item.categoryName)!,
            source: item.source,
          }));
          assignmentCount += (await tx.companyCategory.createMany({ data, skipDuplicates: true }))
            .count;
        }
        const settings = await tx.setting.createMany({
          skipDuplicates: true,
          data: [
            ['ai_enabled', 'false'],
            ['ai_provider', ''],
            ['ai_daily_limit', '0'],
            ['ai_matching_enabled', 'false'],
            ['ai_skill_extraction_enabled', 'false'],
            ['default_match_threshold', '70'],
            ['email_enabled', 'false'],
            ['quick_search_daily_limit', '3'],
            ['quick_search_ai_daily_limit', '1'],
            ['quick_search_company_limit', '8'],
          ].map(([key, value]) => ({ key, value })),
        });
        return {
          insertedCompanies: companyCount,
          insertedCategories: categories.count,
          insertedAssignments: assignmentCount,
          insertedSettings: settings.count,
        };
      },
      { maxWait: 5000, timeout: 120000 },
    );
    console.log(JSON.stringify(summary));
  } finally {
    try {
      await prisma.$disconnect();
    } finally {
      await pool.end();
    }
  }
}
void main().catch((error: unknown) => {
  // Database errors can contain hostnames/connection details; print only safe validation messages.
  const message = error instanceof Error ? error.message : '';
  console.error(
    /^(Usage:|Apply requires|Invalid |Missing |Company seed|Category seed|Unsupported category|Seed assignment)/.test(
      message,
    )
      ? message
      : 'Seed failed. Check target schema/connectivity and inspect state before retrying.',
  );
  process.exitCode = 1;
});
