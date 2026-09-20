import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminBasicAuthGuard } from '../../authentication/guards/admin-basic-auth.guard.js';
import { UpdateSettingsDto } from '../dto/update-settings.dto.js';
import { SettingsService } from '../services/settings.service.js';

@Controller('admin/settings')
@UseGuards(AdminBasicAuthGuard)
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get() get() { return this.settings.get(); }
  @Put() async update(@Body() input: UpdateSettingsDto) { await this.settings.update(input); return { ok: true }; }
}
