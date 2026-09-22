import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { SettingsService } from '../../settings/services/settings.service.js';

export type SystemSettings = Awaited<ReturnType<SettingsService['get']>>;

export interface AdminDashboardStats {
  companies: number;
  monitorReady: number;
  jobs: number;
  openJobs: number;
  candidates: number;
  notifications: number;
  crawlFailures24h: number;
}

export interface AdminDashboardRecentCrawlLog {
  id: string;
  companyName: string;
  checkedAt: Date;
  success: boolean;
  jobsFound: number;
  error: string | null;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  settings: SystemSettings;
  recentCrawlLogs: AdminDashboardRecentCrawlLog[];
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Aggregate high-level system statistics, current operational settings, and recent crawler events. */
  async getDashboard(): Promise<AdminDashboardData> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      companies,
      monitorReady,
      jobs,
      openJobs,
      candidates,
      notifications,
      crawlFailures24h,
      recentLogs,
      settings,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({
        where: {
          active: true,
          careerUrl: { not: null },
          recommended_action: 'MONITOR_READY',
        },
      }),
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: 'OPEN' } }),
      this.prisma.candidate.count({ where: { active: true } }),
      this.prisma.notification.count(),
      this.prisma.crawlLog.count({
        where: { success: false, checked_at: { gte: oneDayAgo } },
      }),
      this.prisma.crawlLog.findMany({
        take: 8,
        orderBy: [{ checked_at: 'desc' }, { id: 'desc' }],
        include: { companies: { select: { name: true } } },
      }),
      this.settings.get(),
    ]);

    return {
      stats: {
        companies,
        monitorReady,
        jobs,
        openJobs,
        candidates,
        notifications,
        crawlFailures24h,
      },
      settings,
      recentCrawlLogs: recentLogs.map((log) => ({
        id: log.id.toString(),
        companyName: log.companies?.name ?? 'Unknown',
        checkedAt: log.checked_at,
        success: log.success,
        jobsFound: log.jobs_found,
        error: log.error,
      })),
    };
  }
}
