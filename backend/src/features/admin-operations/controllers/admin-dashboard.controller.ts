import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import {
  AdminDashboardService,
  type AdminDashboardData,
} from '../services/admin-dashboard.service.js';

/** Basic-authenticated operations overview and live statistics endpoint. */
@Controller('admin/dashboard')
@UseGuards(AdminBasicAuthGuard)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  /** Return aggregated system statistics, settings summary, and recent crawler activity. */
  @Get()
  get(): Promise<AdminDashboardData> {
    return this.dashboard.getDashboard();
  }
}
