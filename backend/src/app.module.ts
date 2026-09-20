import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@app/database';
import { AppController } from './app.controller.js';
import { AuthenticationModule } from './features/authentication/authentication.module.js';
import { AppConfigurationModule } from './config/config.module.js';
import { CandidatePortalModule } from './features/candidate-portal/candidate-portal.module.js';
import { CompanyIntelligenceModule } from './features/company-intelligence/company-intelligence.module.js';
import { JobCrawlingModule } from './features/job-crawling/job-crawling.module.js';
import { SettingsModule } from './features/settings/settings.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }), AppConfigurationModule, PrismaModule, AuthenticationModule, CandidatePortalModule, CompanyIntelligenceModule, JobCrawlingModule, SettingsModule],
  controllers: [AppController],
})
export class AppModule {}
