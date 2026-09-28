import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import {
  extractWebsiteFromLinkedInHtml,
  normalizeLinkedInCompanyUrl,
} from '../domain/linkedin-parser.js';

export interface LinkedInEnrichResult {
  companyId: string;
  companyName: string;
  linkedinUrl: string;
  websiteUrl: string | null;
  careerUrl: string | null;
  success: boolean;
  actionTaken: 'DISCOVERED_CAREER_URL' | 'DISCOVERED_WEBSITE_ONLY' | 'NO_WEBSITE_FOUND' | 'FETCH_FAILED';
  durationMs: number;
  error?: string;
}

export interface BatchEnrichSummary {
  totalProcessed: number;
  websitesFound: number;
  careersFound: number;
  failed: number;
  results: LinkedInEnrichResult[];
}

const CRAWLER_USER_AGENT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class LinkedInEnrichmentCrawlerService {
  private readonly logger = new Logger(LinkedInEnrichmentCrawlerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns count of companies pending LinkedIn enrichment.
   */
  async getPendingCount(): Promise<{ pendingCount: number }> {
    const pendingCount = await this.prisma.company.count({
      where: {
        active: true,
        recommended_action: 'ENRICH_FROM_LINKEDIN',
        linkedin_url: { not: null },
      },
    });
    return { pendingCount };
  }

  /**
   * Enriches a single company by fetching its LinkedIn profile and discovering its website and career URLs.
   */
  async enrichSingleCompany(companyId: string): Promise<LinkedInEnrichResult> {
    const started = performance.now();
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        linkedin_url: true,
        website_url: true,
        careerUrl: true,
      },
    });

    if (!company) {
      throw new NotFoundException({
        code: 'COMPANY_NOT_FOUND',
        message: `Company ${companyId} was not found.`,
      });
    }

    if (!company.linkedin_url) {
      return {
        companyId: company.id,
        companyName: company.name,
        linkedinUrl: '',
        websiteUrl: company.website_url,
        careerUrl: company.careerUrl,
        success: false,
        actionTaken: 'NO_WEBSITE_FOUND',
        durationMs: Math.round(performance.now() - started),
        error: 'Company has no LinkedIn URL configured',
      };
    }

    const normalizedLinkedInUrl = normalizeLinkedInCompanyUrl(company.linkedin_url);
    const result = await this.scrapeLinkedInAndDiscoverCareer(
      company.id,
      company.name,
      normalizedLinkedInUrl,
      company.website_url,
      company.careerUrl,
    );

    const durationMs = Math.round(performance.now() - started);
    result.durationMs = durationMs;

    // Persist changes to database
    await this.persistEnrichmentResult(company.id, result);

    return result;
  }

  /**
   * Enriches a batch of companies currently in ENRICH_FROM_LINKEDIN status.
   */
  async enrichPendingBatch(options?: {
    limit?: number;
    delayMs?: number;
    onProgress?: (result: LinkedInEnrichResult, index: number, total: number) => void;
  }): Promise<BatchEnrichSummary> {
    const limit = options?.limit ?? 50;
    const delayMs = options?.delayMs ?? 1200;

    const companies = await this.prisma.company.findMany({
      where: {
        active: true,
        recommended_action: 'ENRICH_FROM_LINKEDIN',
        linkedin_url: { not: null },
      },
      select: {
        id: true,
        name: true,
        linkedin_url: true,
        website_url: true,
        careerUrl: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    });

    const results: LinkedInEnrichResult[] = [];
    let websitesFound = 0;
    let careersFound = 0;
    let failed = 0;

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const started = performance.now();
      try {
        const normalizedLinkedIn = normalizeLinkedInCompanyUrl(company.linkedin_url!);
        const res = await this.scrapeLinkedInAndDiscoverCareer(
          company.id,
          company.name,
          normalizedLinkedIn,
          company.website_url,
          company.careerUrl,
        );
        res.durationMs = Math.round(performance.now() - started);

        await this.persistEnrichmentResult(company.id, res);
        results.push(res);

        if (res.websiteUrl) websitesFound++;
        if (res.careerUrl) careersFound++;
        if (!res.success) failed++;

        if (options?.onProgress) {
          options.onProgress(res, i + 1, companies.length);
        }
      } catch (err: unknown) {
        const durationMs = Math.round(performance.now() - started);
        const failResult: LinkedInEnrichResult = {
          companyId: company.id,
          companyName: company.name,
          linkedinUrl: company.linkedin_url!,
          websiteUrl: company.website_url,
          careerUrl: company.careerUrl,
          success: false,
          actionTaken: 'FETCH_FAILED',
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        };
        await this.persistEnrichmentResult(company.id, failResult);
        results.push(failResult);
        failed++;
      }

      // Polite delay between requests to preserve anti-bot compliance
      if (i < companies.length - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return {
      totalProcessed: companies.length,
      websitesFound,
      careersFound,
      failed,
      results,
    };
  }

  /**
   * Scrapes public LinkedIn page for website and attempts career URL discovery.
   */
  private async scrapeLinkedInAndDiscoverCareer(
    companyId: string,
    companyName: string,
    linkedinUrl: string,
    existingWebsite: string | null,
    existingCareer: string | null,
  ): Promise<LinkedInEnrichResult> {
    let websiteUrl = existingWebsite;
    let careerUrl = existingCareer;

    // 1. If website is missing, crawl LinkedIn profile
    if (!websiteUrl) {
      const html = await this.fetchLinkedInHtml(linkedinUrl);
      if (html) {
        const extracted = extractWebsiteFromLinkedInHtml(html);
        if (extracted) {
          websiteUrl = extracted;
        }
      }
    }

    // If still no website found
    if (!websiteUrl) {
      return {
        companyId,
        companyName,
        linkedinUrl,
        websiteUrl: null,
        careerUrl: existingCareer,
        success: false,
        actionTaken: 'NO_WEBSITE_FOUND',
        durationMs: 0,
        error: 'No official website link identified on LinkedIn profile',
      };
    }

    // 2. If career URL is missing, discover from website
    if (!careerUrl && websiteUrl) {
      careerUrl = await this.discoverCareerUrlFromWebsite(websiteUrl);
    }

    if (careerUrl) {
      return {
        companyId,
        companyName,
        linkedinUrl,
        websiteUrl,
        careerUrl,
        success: true,
        actionTaken: 'DISCOVERED_CAREER_URL',
        durationMs: 0,
      };
    }

    return {
      companyId,
      companyName,
      linkedinUrl,
      websiteUrl,
      careerUrl: null,
      success: true,
      actionTaken: 'DISCOVERED_WEBSITE_ONLY',
      durationMs: 0,
    };
  }

  /**
   * Fetches public LinkedIn HTML using crawler user-agent.
   */
  private async fetchLinkedInHtml(linkedinUrl: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const targetUrl = linkedinUrl.endsWith('/') ? linkedinUrl : `${linkedinUrl}/`;
      const response = await fetch(targetUrl, {
        headers: {
          'user-agent': CRAWLER_USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (!response.ok) {
        this.logger.warn(`LinkedIn request to ${targetUrl} returned HTTP ${response.status}`);
        return null;
      }

      return await response.text();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to fetch LinkedIn profile ${linkedinUrl}: ${msg}`);
      return null;
    }
  }

  /**
   * Inspects website homepage and probes common career paths to discover career URL.
   */
  private async discoverCareerUrlFromWebsite(websiteUrl: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(websiteUrl, {
        headers: {
          'user-agent': CRAWLER_USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (response.ok) {
        const finalUrl = response.url || websiteUrl;
        const html = await response.text();
        const found = this.extractCareerLink(html, finalUrl);
        if (found) return found;
      }
    } catch {
      // Proceed to probe candidate paths if homepage fetch fails
    }

    // Probe candidate subpaths
    const candidates = ['/career', '/careers', '/jobs', '/join-us'];
    for (const candidate of candidates) {
      try {
        const targetUrl = new URL(candidate, websiteUrl).toString();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6_000);

        const res = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'user-agent': CRAWLER_USER_AGENT,
            accept: 'text/html,application/xhtml+xml',
          },
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timer);

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            const finalUrl = res.url || targetUrl;
            return finalUrl;
          }
        }
      } catch {
        // Continue probing next candidate
      }
    }

    return null;
  }

  /**
   * Scans HTML anchor tags for career and jobs links.
   */
  private extractCareerLink(html: string, baseUrl: string): string | null {
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
        } catch {
          // Skip invalid URL resolutions
        }
      }
    }
    return null;
  }

  /**
   * Updates company record and logs crawl activity in crawl_logs.
   */
  private async persistEnrichmentResult(
    companyId: string,
    result: LinkedInEnrichResult,
  ): Promise<void> {
    const now = new Date();

    if (result.websiteUrl) {
      const recommendedAction = result.careerUrl ? 'MONITOR_READY' : 'FIND_CAREER_PAGE';
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          website_url: result.websiteUrl,
          ...(result.careerUrl ? { careerUrl: result.careerUrl } : {}),
          recommended_action: recommendedAction,
          needs_enrichment: false,
          enrichment_reasons: null,
          last_checked_at: now,
          updated_at: now,
        },
      });
    } else {
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          last_checked_at: now,
          updated_at: now,
        },
      });
    }

    try {
      await this.prisma.crawlLog.create({
        data: {
          company_id: companyId,
          checked_at: now,
          success: result.success,
          crawler_type: 'LinkedIn Enrichment',
          action_taken: result.actionTaken,
          duration_ms: result.durationMs,
          error: result.error ?? null,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to write crawl log for company ${companyId}: ${msg}`);
    }
  }
}
