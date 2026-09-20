import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { JobListQueryDto } from '../dto/job-list-query.dto.js';
import { AdminJobCatalogService } from '../services/admin-job-catalog.service.js';

@Controller('admin/jobs')
@UseGuards(AdminBasicAuthGuard)
export class AdminJobsController {
  constructor(private readonly jobs: AdminJobCatalogService) {}
  @Get() list(@Query() query: JobListQueryDto) { return this.jobs.list(query); }
}
