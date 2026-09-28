import { URL } from 'node:url';

/**
 * Normalizes a raw LinkedIn company URL by stripping query parameters,
 * tracking tags, and redundant trailing paths so requests target the canonical company about page.
 */
export function normalizeLinkedInCompanyUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    parsed.search = '';
    parsed.hash = '';

    // Standardize pathname to /company/<slug>
    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (pathname.endsWith('/about')) {
      pathname = pathname.slice(0, -6);
    }
    parsed.pathname = pathname;
    return parsed.toString();
  } catch {
    return trimmed.replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

/**
 * Normalizes and validates an extracted website URL.
 * Excludes social media platforms, search engines, and invalid schemes.
 */
export function validateAndCleanWebsiteUrl(urlStr: string): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const trimmed = urlStr.trim();
  try {
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    const hostname = url.hostname.toLowerCase();
    if (!hostname || !hostname.includes('.')) return null;
    // Exclude major non-company domains
    const excludedHosts = [
      'linkedin.com',
      'licdn.com',
      'lnkd.in',
      'google.com',
      'facebook.com',
      'fb.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'youtube.com',
      'schema.org',
      'w3.org',
      'bing.com',
      'microsoft.com',
      'apple.com',
    ];
    if (excludedHosts.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
      return null;
    }

    // Strip analytics/tracking params
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'urlhash',
    ];
    for (const param of trackingParams) {
      url.searchParams.delete(param);
    }

    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Pure parser that extracts the official company website from a public LinkedIn company page HTML.
 * Scans for:
 * 1. data-test-id="about-us__website" block and its redir/redirect query parameter.
 * 2. Anchor tags with data-tracking-control-name="about_website".
 * 3. JSON-LD schema metadata for Organization url.
 * 4. Regular expression fallback for external website links.
 */
export function extractWebsiteFromLinkedInHtml(html: string): string | null {
  if (!html || typeof html !== 'string') return null;

  // 1. Target data-test-id="about-us__website" block (highest accuracy)
  const websiteBlockMatch = html.match(
    /data-test-id=["']about-us__website["'][\s\S]*?<\/dd>/i,
  );
  if (websiteBlockMatch) {
    const block = websiteBlockMatch[0];

    // Check for LinkedIn redirect URL: url=https%3A%2F%2F...
    const redirMatch = block.match(/url=([^&"'\s<>]+)/i);
    if (redirMatch) {
      try {
        const decoded = decodeURIComponent(redirMatch[1]);
        const cleaned = validateAndCleanWebsiteUrl(decoded);
        if (cleaned) return cleaned;
      } catch {
        // Fall through to text match
      }
    }

    // Check for anchor text inside the block: <a ...>https://company.com</a>
    const anchorTextMatch = block.match(/<a[^>]*>\s*(https?:\/\/[^\s<]+)/i);
    if (anchorTextMatch) {
      const cleaned = validateAndCleanWebsiteUrl(anchorTextMatch[1]);
      if (cleaned) return cleaned;
    }

    // Check for plain domain text inside anchor or dd: <a ...>www.company.com</a>
    const plainDomainMatch = block.match(/<a[^>]*>\s*([a-z0-9][a-z0-9-]+\.[a-z]{2,}[^\s<]*)/i);
    if (plainDomainMatch) {
      const cleaned = validateAndCleanWebsiteUrl(`https://${plainDomainMatch[1]}`);
      if (cleaned) return cleaned;
    }
  }

  // 2. Target data-tracking-control-name="about_website" anywhere in the document
  const aboutTrackingMatch = html.match(
    /<a[^>]*data-tracking-control-name=["']about_website["'][^>]*href=["']([^"']+)["'][^>]*>/i,
  );
  if (aboutTrackingMatch) {
    const href = aboutTrackingMatch[1];
    const redirMatch = href.match(/url=([^&"'\s<>]+)/i);
    if (redirMatch) {
      try {
        const decoded = decodeURIComponent(redirMatch[1]);
        const cleaned = validateAndCleanWebsiteUrl(decoded);
        if (cleaned) return cleaned;
      } catch {
        // Ignore decoding errors
      }
    } else {
      const cleaned = validateAndCleanWebsiteUrl(href);
      if (cleaned) return cleaned;
    }
  }

  // 3. Target JSON-LD Schema (e.g. "author":{"@type":"Organization","sameAs":"..."})
  const jsonLdBlocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const objects = Array.isArray(data)
        ? data
        : data['@graph'] && Array.isArray(data['@graph'])
          ? data['@graph']
          : [data];

      for (const obj of objects) {
        if (obj?.url && typeof obj.url === 'string') {
          const cleaned = validateAndCleanWebsiteUrl(obj.url);
          if (cleaned) return cleaned;
        }
        if (obj?.sameAs) {
          const sameAsList = Array.isArray(obj.sameAs) ? obj.sameAs : [obj.sameAs];
          for (const item of sameAsList) {
            if (typeof item === 'string') {
              const cleaned = validateAndCleanWebsiteUrl(item);
              if (cleaned) return cleaned;
            }
          }
        }
      }
    } catch {
      // Ignore JSON parse errors in malformed script tags
    }
  }

  return null;
}
