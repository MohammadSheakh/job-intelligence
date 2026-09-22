import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AdminCandidatesController } from './controllers/admin-candidates.controller.js';
import { AdminCandidatesService } from './services/admin-candidates.service.js';
import { AdminDashboardController } from './controllers/admin-dashboard.controller.js';
import { AdminDashboardService } from './services/admin-dashboard.service.js';

@Module({
  imports: [AuthenticationModule, SettingsModule],
  controllers: [AdminCandidatesController, AdminDashboardController],
  providers: [AdminCandidatesService, AdminDashboardService],
  exports: [AdminCandidatesService, AdminDashboardService],
})
export class AdminOperationsModule {}
