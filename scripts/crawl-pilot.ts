import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { parse } from 'csv-parse/sync';

const here = path.dirname(fileURLToPath(import.meta.url));
const csv = fs.readFileSync(path.join(here, '../data/pilot_20_companies.csv'), 'utf8');
const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as Record<
  string,
  string
>[];

function absoluteUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

for (const row of rows.slice(0, 5)) {
  const company = row['Company Name'];
  const url = row['Career URL'];
  if (!url) continue;
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'JobIntelligenceBot/0.1 (+career-monitoring)' },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const links = $('a[href]')
      .map((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (!href || !text) return null;
        const applicationUrl = absoluteUrl(response.url, href);
        if (!applicationUrl) return null;
        const signal = `${text} ${applicationUrl}`.toLowerCase();
        if (!/(career|job|vacan|position|apply|opening)/.test(signal)) return null;
        return { title: text.slice(0, 180), applicationUrl };
      })
      .get();
    const unique = [...new Map(links.map((x) => [x.applicationUrl, x])).values()];
    console.log(
      JSON.stringify(
        {
          company,
          url,
          status: response.status,
          candidates: unique.slice(0, 10),
          pageHash: crypto.createHash('sha256').update(html).digest('hex').slice(0, 12),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        company,
        url,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
