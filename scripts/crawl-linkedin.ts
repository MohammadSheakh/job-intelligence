import 'dotenv/config';
import { db, closeDb } from '../src/db.js';
import {
  extractWebsiteFromLinkedInHtml,
  normalizeLinkedInCompanyUrl,
} from '../backend/src/features/company-intelligence/domain/linkedin-parser.js';

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find((v) => v.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
const delayArg = process.argv.find((v) => v.startsWith('--delay='));
const delayMs = delayArg ? Number(delayArg.split('=')[1]) : 1200;
const companyArg = process.argv.find((v) => v.startsWith('--company='));
const targetCompanyId = companyArg ? companyArg.split('=')[1] : undefined;

const CRAWLER_USER_AGENT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function extractCareerLink(html: string, baseUrl: string): string | null {
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const careerPathRegex =
    /(careers?|jobs?|join-us|work-with-us|openings|vacanc(y|ies)|career-opportunities)(\/|$|\?)/i;
  const careerTextRegex =
    /\b(careers?|jobs?|join our team|work with us|current openings|open positions|we['’]re hiring)\b/i;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]?.trim();
    const text = (match[2] ?? '').replace(/<[^>]+>/g, ' ').trim();
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    ) {
      continue;
    }
    if (careerPathRegex.test(href) || careerTextRegex.test(text)) {
      try {
        const resolved = new URL(href, baseUrl);
        if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
          return resolved.href;
        }
      } catch {}
    }
  }
  return null;
}

async function discoverCareerUrl(websiteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(websiteUrl, {
      headers: {
        'user-agent': CRAWLER_USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (res.ok) {
      const html = await res.text();
      const found = extractCareerLink(html, res.url || websiteUrl);
      if (found) return found;
    }
  } catch {}

  const candidates = ['/career', '/careers', '/jobs', '/join-us'];
  for (const candidate of candidates) {
    try {
      const probeUrl = new URL(candidate, websiteUrl).toString();
      const res = await fetch(probeUrl, {
        method: 'GET',
        headers: {
          'user-agent': CRAWLER_USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) {
          return res.url || probeUrl;
        }
      }
    } catch {}
  }

  return null;
}

async function main() {
  console.log('=== LinkedIn Company Website & Career Page Crawler ===');
  console.log(`Mode: ${apply ? 'APPLY (writing changes to DB)' : 'DRY RUN (no DB changes)'}`);
  if (limit) console.log(`Limit: ${limit}`);
  if (targetCompanyId) console.log(`Target Company: ${targetCompanyId}`);
  console.log(`Delay between requests: ${delayMs}ms\n`);

  let query = `
    SELECT id, name, linkedin_url, website_url, career_url
    FROM companies
    WHERE active = true
      AND recommended_action = 'ENRICH_FROM_LINKEDIN'
      AND linkedin_url IS NOT NULL
  `;
  const params: any[] = [];
  if (targetCompanyId) {
    params.push(targetCompanyId);
    query += ` AND id = $${params.length}`;
  }
  query += ' ORDER BY name ASC';
  if (limit) {
    params.push(limit);
    query += ` LIMIT $${params.length}`;
  }

  const { rows: companies } = await db.query(query, params);
  console.log(`Found ${companies.length} candidate companies for enrichment.\n`);

  let websitesDiscovered = 0;
  let careersDiscovered = 0;
  let failed = 0;

  for (let i = 0; i < companies.length; i++) {
    const comp = companies[i];
    const started = performance.now();
    const prefix = `[${i + 1}/${companies.length}] ${comp.name} (${comp.id})`;

    const normalizedLinkedIn = normalizeLinkedInCompanyUrl(comp.linkedin_url);
    const targetUrl = normalizedLinkedIn.endsWith('/') ? normalizedLinkedIn : `${normalizedLinkedIn}/`;

    let discoveredWebsite: string | null = null;
    let discoveredCareer: string | null = null;
    let errorMsg: string | null = null;

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'user-agent': CRAWLER_USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      });

      if (!response.ok) {
        errorMsg = `LinkedIn returned HTTP ${response.status}`;
      } else {
        const html = await response.text();
        discoveredWebsite = extractWebsiteFromLinkedInHtml(html);
        if (!discoveredWebsite) {
          errorMsg = 'No website found in LinkedIn HTML';
        }
      }
    } catch (err: any) {
      errorMsg = err?.message || String(err);
    }

    if (discoveredWebsite) {
      websitesDiscovered++;
      // Discover career URL
      discoveredCareer = await discoverCareerUrl(discoveredWebsite);
      if (discoveredCareer) {
        careersDiscovered++;
      }

      const durationMs = Math.round(performance.now() - started);
      const newAction = discoveredCareer ? 'MONITOR_READY' : 'FIND_CAREER_PAGE';

      console.log(`✓ ${prefix}`);
      console.log(`  Website: ${discoveredWebsite}`);
      if (discoveredCareer) {
        console.log(`  Career:  ${discoveredCareer} -> ${newAction}`);
      } else {
        console.log(`  Career:  (none detected) -> ${newAction}`);
      }

      if (apply) {
        await db.query(
          `
          UPDATE companies
          SET website_url = $1,
              career_url = COALESCE($2, career_url),
              recommended_action = $3,
              needs_enrichment = false,
              enrichment_reasons = null,
              last_checked_at = NOW(),
              updated_at = NOW()
          WHERE id = $4
        `,
          [discoveredWebsite, discoveredCareer, newAction, comp.id],
        );

        await db.query(
          `
          INSERT INTO crawl_logs (
            company_id, checked_at, success, crawler_type, action_taken, duration_ms
          ) VALUES ($1, NOW(), true, 'LinkedIn Enrichment', $2, $3)
        `,
          [
            comp.id,
            discoveredCareer ? 'DISCOVERED_CAREER_URL' : 'DISCOVERED_WEBSITE_ONLY',
            durationMs,
          ],
        );
      }
    } else {
      failed++;
      const durationMs = Math.round(performance.now() - started);
      console.log(`✗ ${prefix}`);
      console.log(`  LinkedIn: ${comp.linkedin_url}`);
      console.log(`  Reason:   ${errorMsg || 'Not found'}`);

      if (apply) {
        await db.query(
          `
          UPDATE companies
          SET last_checked_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `,
          [comp.id],
        );

        await db.query(
          `
          INSERT INTO crawl_logs (
            company_id, checked_at, success, crawler_type, action_taken, duration_ms, error
          ) VALUES ($1, NOW(), false, 'LinkedIn Enrichment', 'NO_WEBSITE_FOUND', $2, $3)
        `,
          [comp.id, durationMs, errorMsg],
        );
      }
    }

    if (i < companies.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log('\n================ Summary ================');
  console.log(`Total Processed:    ${companies.length}`);
  console.log(`Websites Extracted: ${websitesDiscovered}`);
  console.log(`Careers Discovered: ${careersDiscovered}`);
  console.log(`Unresolved/Failed:  ${failed}`);
  console.log(`Execution Mode:     ${apply ? 'Applied to DB' : 'Dry Run (use --apply to write)'}`);
  console.log('=========================================\n');
}

main()
  .catch((err) => {
    console.error('Fatal error in LinkedIn crawler script:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
