import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '@app/database';
import { SlidingWindowRateLimitGuard } from '@app/common';
import { AppController } from './app.controller.js';
import { AuthenticationModule } from './features/authentication/authentication.module.js';
import { AppConfigurationModule } from './config/config.module.js';
import { CandidatePortalModule } from './features/candidate-portal/candidate-portal.module.js';
import { CompanyIntelligenceModule } from './features/company-intelligence/company-intelligence.module.js';
import { JobCrawlingModule } from './features/job-crawling/job-crawling.module.js';
import { SettingsModule } from './features/settings/settings.module.js';
import { AdminOperationsModule } from './features/admin-operations/admin-operations.module.js';
import { NotificationsModule } from './features/notifications/notifications.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    AppConfigurationModule,
    PrismaModule,
    RedisModule,
    AuthenticationModule,
    CandidatePortalModule,
    CompanyIntelligenceModule,
    JobCrawlingModule,
    SettingsModule,
    AdminOperationsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SlidingWindowRateLimitGuard,
    },
  ],
})
export class AppModule {}
