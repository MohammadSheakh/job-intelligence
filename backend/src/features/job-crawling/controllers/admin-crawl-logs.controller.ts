import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { CrawlLogListQueryDto } from '../dto/crawl-log-list-query.dto.js';
import { AdminCrawlLogService } from '../services/admin-crawl-log.service.js';

@Controller('admin/crawl-logs')
@UseGuards(AdminBasicAuthGuard)
export class AdminCrawlLogsController {
  constructor(private readonly logs: AdminCrawlLogService) {}

  @Get()
  list(
    @Query()
    query: CrawlLogListQueryDto,
  ) {
    return this.logs.list(query);
  }
}
