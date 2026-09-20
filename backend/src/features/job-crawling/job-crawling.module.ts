import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { AdminJobsController } from './controllers/admin-jobs.controller.js';
import { AdminCrawlLogsController } from './controllers/admin-crawl-logs.controller.js';
import { AdminJobCatalogService } from './services/admin-job-catalog.service.js';
import { AdminCrawlLogService } from './services/admin-crawl-log.service.js';

@Module({ imports: [AuthenticationModule], controllers: [AdminJobsController, AdminCrawlLogsController], providers: [AdminJobCatalogService, AdminCrawlLogService] })
export class JobCrawlingModule {}
