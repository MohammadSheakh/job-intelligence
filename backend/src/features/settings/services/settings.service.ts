import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { UpdateSettingsDto } from '../dto/update-settings.dto.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const values = new Map(
      (await this.prisma.setting.findMany({ select: { key: true, value: true } })).map(
        (setting) => [setting.key, setting.value],
      ),
    );
    const bool = (key: string, fallback = false) =>
      (values.get(key) ?? String(fallback)).toLowerCase() === 'true';
    const number = (key: string, fallback: number) => {
      const value = Number(values.get(key));
      return Number.isFinite(value) ? value : fallback;
    };
    return {
      aiEnabled: bool('ai_enabled'),
      aiProvider: values.get('ai_provider') ?? '',
      aiDailyLimit: Math.max(0, number('ai_daily_limit', 0)),
      aiMatchingEnabled: bool('ai_matching_enabled'),
      aiSkillExtractionEnabled: bool('ai_skill_extraction_enabled'),
      defaultMatchThreshold: Math.max(0, Math.min(100, number('default_match_threshold', 70))),
      emailEnabled: bool('email_enabled'),
      quickSearchDailyLimit: Math.max(0, number('quick_search_daily_limit', 3)),
      quickSearchAiDailyLimit: Math.max(0, number('quick_search_ai_daily_limit', 1)),
      quickSearchCompanyLimit: Math.max(1, number('quick_search_company_limit', 8)),
    };
  }

  async update(input: UpdateSettingsDto): Promise<void> {
    const entries: Array<[string, string]> = [
      ['ai_enabled', String(input.aiEnabled)],
      ['ai_provider', input.aiProvider.trim()],
      ['ai_daily_limit', String(input.aiDailyLimit)],
      ['ai_matching_enabled', String(input.aiMatchingEnabled)],
      ['ai_skill_extraction_enabled', String(input.aiSkillExtractionEnabled)],
      ['default_match_threshold', String(input.defaultMatchThreshold)],
      ['email_enabled', String(input.emailEnabled)],
      ['quick_search_daily_limit', String(input.quickSearchDailyLimit)],
      ['quick_search_ai_daily_limit', String(input.quickSearchAiDailyLimit)],
      ['quick_search_company_limit', String(input.quickSearchCompanyLimit)],
    ];
    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value, updated_at: new Date() },
        }),
      ),
    );
  }
}
