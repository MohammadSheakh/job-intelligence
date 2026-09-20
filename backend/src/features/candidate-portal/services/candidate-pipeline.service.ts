import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { SaveCompanyStateDto } from '../dto/save-company-state.dto.js';
@Injectable()
export class CandidatePipelineService {
  constructor(private readonly prisma: PrismaService) {}
  async save(candidateId: bigint, input: SaveCompanyStateDto): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: input.companyId }, select: { id: true } });
    if (!company) throw new NotFoundException({ code: 'COMPANY_NOT_FOUND', message: 'Company was not found.' });
    const lastAppliedAt = input.lastAppliedAt
      ? new Date(input.lastAppliedAt)
      : input.status === 'APPLIED' ? new Date(new Date().toISOString().slice(0, 10)) : null;
    const state = {
      status: input.status,
      reapply_count: input.reapplyCount ?? 0,
      notes: input.notes?.trim() || null,
    };
    await this.prisma.candidate_company_state.upsert({
      where: { candidate_id_company_id: { candidate_id: candidateId, company_id: company.id } },
      create: { candidate_id: candidateId, company_id: company.id, ...state, last_applied_at: lastAppliedAt },
      update: { ...state, last_applied_at: lastAppliedAt ?? undefined, updated_at: new Date() },
    });
  }
  async list(candidateId: bigint, status?: 'PLANNING' | 'APPLIED' | 'EXCLUDED') {
    const rows = await this.prisma.candidate_company_state.findMany({
      where: { candidate_id: candidateId, ...(status ? { status } : {}) },
      include: { companies: { include: { categories: { include: { category: { select: { name: true } } } } } } },
      orderBy: [{ updated_at: 'desc' }],
    });
    const rank = { PLANNING: 1, APPLIED: 2, EXCLUDED: 3 } as const;
    return rows.sort((a, b) => rank[a.status as keyof typeof rank] - rank[b.status as keyof typeof rank] || a.companies.name.localeCompare(b.companies.name)).map((row) => ({ companyId: row.company_id, companyName: row.companies.name, status: row.status, lastAppliedAt: row.last_applied_at?.toISOString().slice(0, 10) ?? null, reapplyCount: row.reapply_count, notes: row.notes, categories: row.companies.categories.map((item) => item.category.name).filter((name) => name !== 'Other') }));
  }
  async remove(candidateId: bigint, companyId: string): Promise<void> { await this.prisma.candidate_company_state.deleteMany({ where: { candidate_id: candidateId, company_id: companyId } }); }
}
