import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { JobListQueryDto } from '../dto/job-list-query.dto.js';

/**
 * Exposes a read-only jobs catalog; crawler execution and job mutation are outside this service.
 */
@Injectable()
export class AdminJobCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Filter jobs and paginate by discovery time with an ID tie-breaker, projecting company/category
   * context.
   */
  async list(input: JobListQueryDto) {
    const search = input.search?.trim();
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { location: { contains: search, mode: 'insensitive' as const } },
              { company: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: [{ first_seen_at: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          title: true,
          location: true,
          work_mode: true,
          skills: true,
          experience: true,
          application_url: true,
          status: true,
          first_seen_at: true,
          last_seen_at: true,
          company: {
            select: {
              name: true,
              categories: { include: { category: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);
    return {
      total,
      page: input.page,
      pageSize: input.pageSize,
      rows: rows.map((job) => ({
        id: job.id.toString(),
        companyName: job.company.name,
        companyCategories: job.company.categories
          .map((item) => item.category.name)
          .filter((name) => name !== 'Other'),
        title: job.title,
        location: job.location,
        workMode: job.work_mode,
        skills: job.skills,
        experience: job.experience,
        applicationUrl: job.application_url,
        status: job.status,
        firstSeenAt: job.first_seen_at,
        lastSeenAt: job.last_seen_at,
      })),
    };
  }
}
