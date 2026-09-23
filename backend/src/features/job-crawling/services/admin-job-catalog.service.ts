import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    const andConditions: Prisma.JobWhereInput[] = [];

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

    const scope = input.categoryScope ?? 'all';

    const buildCategoryFilter = (filter: {
      name?: string;
      type?: string;
    }): Prisma.JobWhereInput => {
      const categoryCriteria: Prisma.CategoryWhereInput = {};
      if (filter.name) {
        categoryCriteria.name = { equals: filter.name, mode: 'insensitive' };
      }
      if (filter.type) {
        categoryCriteria.type = { equals: filter.type, mode: 'insensitive' };
      }

      const jobCondition = {
        categories: {
          some: {
            category: categoryCriteria,
          },
        },
      };

      const companyCondition = {
        company: {
          categories: {
            some: {
              category: categoryCriteria,
            },
          },
        },
      };

      if (scope === 'job') {
        return jobCondition;
      }
      if (scope === 'company') {
        return companyCondition;
      }
      return {
        OR: [jobCondition, companyCondition],
      };
    };

    if (input.category?.trim()) {
      andConditions.push(buildCategoryFilter({ name: input.category.trim() }));
    }

    if (input.technology?.trim()) {
      andConditions.push(
        buildCategoryFilter({ name: input.technology.trim(), type: 'technology' }),
      );
    }

    if (input.domain?.trim()) {
      andConditions.push(buildCategoryFilter({ name: input.domain.trim(), type: 'domain' }));
    }

    if (input.sector?.trim()) {
      andConditions.push(buildCategoryFilter({ name: input.sector.trim(), type: 'sector' }));
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
        jobCategories: (job.categories ?? [])
          .map((item) => item.category.name)
          .filter((name) => name !== 'Other'),
        jobCategoryDetails: (job.categories ?? [])
          .map((item) => ({
            name: item.category.name,
            type: item.category.type,
            source: item.source,
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
