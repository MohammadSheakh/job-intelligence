import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@app/database';
import { NotificationsModule } from '../features/notifications/notifications.module.js';

/** Minimal command context: database and notification providers, with no listening HTTP server. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    PrismaModule,
    NotificationsModule,
  ],
})
export class NotifyWorkerModule {}
