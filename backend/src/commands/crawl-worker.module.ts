import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@app/database';
import { CrawlExecutionModule } from '../features/job-crawling/crawl-execution.module.js';

/** Minimal command context: database and crawler providers, with no listening HTTP server. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    PrismaModule,
    CrawlExecutionModule,
  ],
})
export class CrawlWorkerModule {}
