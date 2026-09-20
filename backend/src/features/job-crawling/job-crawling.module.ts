import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { AdminJobsController } from './controllers/admin-jobs.controller.js';
import { AdminJobCatalogService } from './services/admin-job-catalog.service.js';

@Module({ imports: [AuthenticationModule], controllers: [AdminJobsController], providers: [AdminJobCatalogService] })
export class JobCrawlingModule {}
