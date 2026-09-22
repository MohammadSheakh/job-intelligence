import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { SettingsService } from '../../settings/services/settings.service.js';
import { deterministicMatch } from '../../matching/domain/matcher.js';
import { AiMatchEnhancerService } from '../../matching/services/ai-match-enhancer.service.js';
import { EmailRenderService } from './email-render.service.js';
import { EmailTransportService } from './email-transport.service.js';
import { NotificationDeduplicationService } from './notification-deduplication.service.js';
import type {
  CandidateNotificationTarget,
  DailyNotificationSummary,
  DigestMatch,
  JobNotificationTarget,
} from '../domain/types.js';

/**
 * Orchestrates candidate email digest distribution:
 * - Checks global email enablement
 * - Filters out already-notified pairs and blacklisted companies
 * - Evaluates deterministic match fit and optional AI enhancement
 * - Renders digest and transmits via SMTP
 * - Persists delivery records atomically so jobs are not repeatedly emailed
 */
@Injectable()
export class DailyNotificationService {
  private readonly logger = new Logger(DailyNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly renderer: EmailRenderService,
    private readonly transport: EmailTransportService,
    private readonly deduplication: NotificationDeduplicationService,
    private readonly aiEnhancer: AiMatchEnhancerService,
  ) {}

  async run(signal?: AbortSignal): Promise<DailyNotificationSummary> {
    const s = await this.settings.get();
    if (!s.emailEnabled) {
      const candidates = await this.prisma.candidate.count({ where: { active: true } });
      const openJobs = await this.prisma.job.count({ where: { status: 'OPEN' } });
      return {
        emailEnabled: false,
        candidateCount: candidates,
        openJobCount: openJobs,
        qualifyingMatchCount: 0,
        digestCount: 0,
        sentDigests: 0,
        sentJobNotifications: 0,
        failedDigests: 0,
        message: 'Email is disabled in settings; no notifications were sent or recorded.',
      };
    }

    const candidates = await this.prisma.candidate.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        expertise: true,
        skills: true,
        experience_level: true,
        preferred_locations: true,
        excluded_locations: true,
        preferred_work_modes: true,
        preferred_categories: true,
        excluded_categories: true,
        minimum_match_score: true,
      },
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const jobs = await this.prisma.job.findMany({
      where: {
        status: 'OPEN',
        OR: [{ application_deadline: null }, { application_deadline: { gte: now } }],
        last_seen_at: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        companyId: true,
        title: true,
        description: true,
        location: true,
        work_mode: true,
        skills: true,
        experience: true,
        application_url: true,
        company: {
          select: {
            name: true,
            website_url: true,
            location: true,
            tech_stack: true,
            categories: {
              select: { category: { select: { name: true, type: true } } },
            },
          },
        },
      },
    });

    const blacklistedRows = await this.prisma.candidate_company_state.findMany({
      where: { status: 'EXCLUDED' },
      select: { candidate_id: true, company_id: true },
    });
    const blacklisted = new Set(blacklistedRows.map((r) => `${r.candidate_id}:${r.company_id}`));

    const notified = await this.deduplication.getNotifiedPairSet();
    const aiAvailable = await this.aiEnhancer.isAvailable();
    const aiLimitState = { callsMade: 0 };

    const candidateMatchesMap = new Map<bigint, DigestMatch[]>();
    let qualifyingMatchCount = 0;

    for (const candidate of candidates) {
      if (signal?.aborted) break;
      const candidateMatches: DigestMatch[] = [];

      const candidateProfile: CandidateNotificationTarget = {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        expertise: candidate.expertise,
        skills: candidate.skills,
        experienceLevel: candidate.experience_level,
        preferredLocations: candidate.preferred_locations,
        excludedLocations: candidate.excluded_locations,
        preferredWorkModes: candidate.preferred_work_modes,
        preferredCategories: candidate.preferred_categories,
        excludedCategories: candidate.excluded_categories,
        minimumMatchScore: candidate.minimum_match_score,
      };

      for (const job of jobs) {
        if (signal?.aborted) break;
        if (notified.has(`${candidate.id}:${job.id}`)) continue;
        if (blacklisted.has(`${candidate.id}:${job.companyId}`)) continue;

        const company = job.company;
        const categories = company.categories.map(({ category }) => category);
        const categoryNames = categories
          .filter(({ name }) => name !== 'Other')
          .map(({ name }) => name);
        const sectorNames = categories
          .filter(({ type }) => type === 'sector')
          .map(({ name }) => name);

        const jobTarget: JobNotificationTarget = {
          id: job.id,
          title: job.title,
          description: job.description,
          location: job.location,
          workMode: job.work_mode,
          skills: job.skills,
          experience: job.experience,
          applicationUrl: job.application_url,
          companyName: company.name,
          companyWebsiteUrl: company.website_url,
          companyLocation: company.location,
          companyTechStack: company.tech_stack,
          companyCategories: categoryNames,
          companySectorCategories: sectorNames,
        };

        const base = deterministicMatch(candidateProfile, jobTarget);
        if (!base.eligible) continue;

        let finalResult = base;
        if (aiAvailable) {
          finalResult = await this.aiEnhancer.enhance(
            candidateProfile,
            jobTarget,
            base,
            aiLimitState,
          );
        }

        const threshold = candidate.minimum_match_score ?? s.defaultMatchThreshold;
        if (finalResult.finalScore < threshold) continue;

        candidateMatches.push({
          candidate: candidateProfile,
          job: jobTarget,
          threshold,
          result: finalResult,
        });
      }

      if (candidateMatches.length > 0) {
        candidateMatchesMap.set(candidate.id, candidateMatches);
        qualifyingMatchCount += candidateMatches.length;
      }
    }

    let sentDigests = 0;
    let sentJobNotifications = 0;
    let failedDigests = 0;

    for (const [candidateId, matches] of candidateMatchesMap.entries()) {
      if (signal?.aborted) break;
      const candidate = matches[0].candidate;
      const digest = this.renderer.renderDigest(candidate.name, matches);

      try {
        await this.transport.send({
          to: candidate.email,
          subject: digest.subject,
          text: digest.text,
          html: digest.html,
        });

        await this.deduplication.recordNotifications(
          matches.map((m) => ({
            candidateId,
            jobId: m.job.id,
            matchScore: m.result.finalScore,
          })),
        );

        sentDigests += 1;
        sentJobNotifications += matches.length;
      } catch (error) {
        failedDigests += 1;
        this.logger.error({
          message: `Failed to deliver digest to candidate ${candidate.email}`,
          candidateId: candidate.id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      emailEnabled: true,
      candidateCount: candidates.length,
      openJobCount: jobs.length,
      qualifyingMatchCount,
      digestCount: candidateMatchesMap.size,
      sentDigests,
      sentJobNotifications,
      failedDigests,
    };
  }
}
