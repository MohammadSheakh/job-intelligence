import crypto from 'node:crypto';
import type { CrawledJob } from './types.js';

export function normalizeWhitespace(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeTitle(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^[•\-*–—|]+\s*/, '')
    .replace(/\s*[|·]\s*(apply now|view details?|details?)$/i, '')
    .trim();
}

export function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';

  const removable = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
  ];
  for (const key of removable) url.searchParams.delete(key);

  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export function normalizeLocation(value: string | undefined): string | undefined {
  const normalized = normalizeWhitespace(value);
  return normalized || undefined;
}

/** Preserve legacy hash identity so imported jobs update instead of duplicating. */
export function createJobHash(
  job: Pick<CrawledJob, 'companyId' | 'title' | 'location' | 'applicationUrl'>,
): string {
  const payload = [
    job.companyId.toLowerCase(),
    normalizeTitle(job.title).toLowerCase(),
    (normalizeLocation(job.location) ?? '').toLowerCase(),
    canonicalizeUrl(job.applicationUrl).toLowerCase(),
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}
