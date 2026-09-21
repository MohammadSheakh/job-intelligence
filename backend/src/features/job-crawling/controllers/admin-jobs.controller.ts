import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { JobListQueryDto } from '../dto/job-list-query.dto.js';
import { AdminJobCatalogService } from '../services/admin-job-catalog.service.js';

/** Basic-authenticated, read-only jobs catalog; this controller does not trigger crawls. */
@Controller('admin/jobs')
@UseGuards(AdminBasicAuthGuard)
export class AdminJobsController {
  constructor(private readonly jobs: AdminJobCatalogService) {}

  /** Return a bounded, filtered page of discovered jobs. */
  @Get()
  list(
    @Query()
    query: JobListQueryDto,
  ) {
    return this.jobs.list(query);
  }
}
