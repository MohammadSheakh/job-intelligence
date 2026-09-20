import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CrawlLogListQueryDto } from '../dto/crawl-log-list-query.dto.js';

@Injectable()
export class AdminCrawlLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: CrawlLogListQueryDto) {
    const where = { company_id: { not: null } };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.crawlLog.count({ where }),
      this.prisma.crawlLog.findMany({ where, orderBy: [{ checked_at: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: { id: true, company_id: true, checked_at: true, success: true, jobs_found: true, error: true, companies: { select: { name: true } } } }),
    ]);
    return { total, page: input.page, pageSize: input.pageSize, rows: rows.filter((row) => row.companies).map((row) => ({ id: row.id.toString(), companyId: row.company_id!, companyName: row.companies!.name, checkedAt: row.checked_at, success: row.success, jobsFound: row.jobs_found, error: row.error })) };
  }
}
