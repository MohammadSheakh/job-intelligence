import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { crawlGeneric } from '../src/crawler/generic.js';
import { createJobHash } from '../src/jobs/normalize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(here, '../data/pilot_20_companies.csv');
const csv = fs.readFileSync(csvPath, 'utf8');
const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as Record<
  string,
  string
>[];
const limit = Number(process.env.CRAWL_LIMIT ?? 5);

for (const row of rows.slice(0, limit)) {
  const companyId = row['Company ID'];
  const company = row['Company Name'];
  const careerUrl = row['Career URL'];
  if (!companyId || !careerUrl) continue;

  try {
    const result = await crawlGeneric(companyId, careerUrl);
    console.log(
      JSON.stringify(
        {
          companyId,
          company,
          careerUrl,
          finalUrl: result.finalUrl,
          noOpeningsSignal: result.noOpeningsSignal,
          jobs: result.jobs.map((job) => ({
            ...job,
            jobHash: createJobHash(job).slice(0, 16),
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        companyId,
        company,
        careerUrl,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
