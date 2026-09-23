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
    const andConditions: any[] = [];

    if (input.status) {
      andConditions.push({ status: input.status });
    }

    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { location: { contains: search, mode: 'insensitive' as const } },
          { company: { name: { contains: search, mode: 'insensitive' as const } } },
          { skills: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }

    if (input.category?.trim()) {
      andConditions.push({
        company: {
          categories: {
            some: {
              category: {
                name: { equals: input.category.trim(), mode: 'insensitive' as const },
              },
            },
          },
        },
      });
    }

    if (input.technology?.trim()) {
      andConditions.push({
        company: {
          categories: {
            some: {
              category: {
                name: { equals: input.technology.trim(), mode: 'insensitive' as const },
                type: { equals: 'technology', mode: 'insensitive' as const },
              },
            },
          },
        },
      });
    }

    if (input.domain?.trim()) {
      andConditions.push({
        company: {
          categories: {
            some: {
              category: {
                name: { equals: input.domain.trim(), mode: 'insensitive' as const },
                type: { equals: 'domain', mode: 'insensitive' as const },
              },
            },
          },
        },
      });
    }

    if (input.sector?.trim()) {
      andConditions.push({
        company: {
          categories: {
            some: {
              category: {
                name: { equals: input.sector.trim(), mode: 'insensitive' as const },
                type: { equals: 'sector', mode: 'insensitive' as const },
              },
            },
          },
        },
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};
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
          application_deadline: true,
          status: true,
          first_seen_at: true,
          last_seen_at: true,
          company: {
            select: {
              id: true,
              name: true,
              website_url: true,
              categories: {
                include: {
                  category: {
                    select: {
                      name: true,
                      type: true,
                    },
                  },
                },
              },
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
        companyId: job.company.id,
        companyName: job.company.name,
        companyWebsiteUrl: job.company.website_url,
        companyCategories: job.company.categories
          .map((item) => item.category.name)
          .filter((name) => name !== 'Other'),
        companyCategoryDetails: job.company.categories
          .map((item) => ({
            name: item.category.name,
            type: item.category.type,
          }))
          .filter((item) => item.name !== 'Other'),
        title: job.title,
        location: job.location,
        workMode: job.work_mode,
        skills: job.skills,
        experience: job.experience,
        applicationUrl: job.application_url,
        applicationDeadline: job.application_deadline,
        status: job.status,
        firstSeenAt: job.first_seen_at,
        lastSeenAt: job.last_seen_at,
      })),
    };
  }
}
