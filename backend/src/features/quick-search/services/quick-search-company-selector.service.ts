import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';
import { SettingsService } from '../../settings/services/settings.service.js';

export interface QuickSearchCompany {
  id: string;
  name: string;
  careerUrl: string;
}

/** Select a bounded crawl shortlist without loading the full company catalog into Node. */
@Injectable()
export class QuickSearchCompanySelectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Prefer matching categories, then least-recently checked companies; never select blacklists. */
  async select(candidateId: bigint): Promise<QuickSearchCompany[]> {
    const [candidate, settings] = await Promise.all([
      this.prisma.candidate.findFirst({
        where: { id: candidateId, active: true },
        select: { preferred_categories: true },
      }),
      this.settings.get(),
    ]);
    if (!candidate) throw new NotFoundException('Candidate profile was not found.');
    const categories = [
      ...new Set(
        (candidate.preferred_categories ?? '')
          .split(/[,;|\n]+/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const preferred = categories.length
      ? Prisma.sql`ARRAY[${Prisma.join(categories)}]::text[]`
      : Prisma.sql`ARRAY[]::text[]`;
    const limit = Math.min(25, Math.max(1, Math.floor(settings.quickSearchCompanyLimit)));
    // Prisma cannot express this filtered related-category count as an orderBy.
    // Keep all user-derived values parameterized, and apply LIMIT inside PostgreSQL.
    return this.prisma.$queryRaw<QuickSearchCompany[]>`
      SELECT c.id, c.name, c.career_url AS "careerUrl"
      FROM companies c
      WHERE c.active = true AND c.recommended_action = 'MONITOR_READY'
        AND c.career_url IS NOT NULL AND btrim(c.career_url) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM candidate_company_state s
          WHERE s.company_id = c.id AND s.candidate_id = ${candidateId} AND s.status = 'EXCLUDED'
        )
      ORDER BY (
        SELECT count(*) FROM company_categories cc JOIN categories cat ON cat.id = cc.category_id
        WHERE cc.company_id = c.id AND cat.name = ANY(${preferred})
      ) DESC, COALESCE(c.last_checked_at, '1970-01-01'::timestamptz) ASC, c.id ASC
      LIMIT ${limit}
    `;
  }
}
