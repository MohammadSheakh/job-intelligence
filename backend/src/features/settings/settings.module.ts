import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { AdminSettingsController } from './controllers/admin-settings.controller.js';
import { SettingsService } from './services/settings.service.js';

@Module({
  imports: [AuthenticationModule],
  controllers: [AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
