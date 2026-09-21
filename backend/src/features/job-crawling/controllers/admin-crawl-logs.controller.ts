import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { CrawlLogListQueryDto } from '../dto/crawl-log-list-query.dto.js';
import { AdminCrawlLogService } from '../services/admin-crawl-log.service.js';

/** Basic-authenticated, read-only crawl history for operational monitoring. */
@Controller('admin/crawl-logs')
@UseGuards(AdminBasicAuthGuard)
export class AdminCrawlLogsController {
  constructor(private readonly logs: AdminCrawlLogService) {}

  /** Return a bounded page of linked-company crawl results. */
  @Get()
  list(
    @Query()
    query: CrawlLogListQueryDto,
  ) {
    return this.logs.list(query);
  }
}
