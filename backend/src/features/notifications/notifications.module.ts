import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { MatchingModule } from '../matching/matching.module.js';
import { EmailRenderService } from './services/email-render.service.js';
import { EmailTransportService } from './services/email-transport.service.js';
import { NotificationDeduplicationService } from './services/notification-deduplication.service.js';
import { DailyNotificationService } from './services/daily-notification.service.js';

@Module({
  imports: [SettingsModule, MatchingModule],
  providers: [
    EmailRenderService,
    EmailTransportService,
    NotificationDeduplicationService,
    DailyNotificationService,
  ],
  exports: [
    EmailRenderService,
    EmailTransportService,
    NotificationDeduplicationService,
    DailyNotificationService,
  ],
})
export class NotificationsModule {}
