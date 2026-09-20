import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CandidateCompanyQueryDto } from '../dto/candidate-company-query.dto.js';
@Injectable()
export class CandidateCompanyService {
  constructor(private readonly prisma: PrismaService) {}
  async list(candidateId: bigint, query: CandidateCompanyQueryDto) {
    const q = query.q?.trim(); const category = query.category?.trim();
    const rows = await this.prisma.company.findMany({ where: { active: true, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { location: { contains: q, mode: 'insensitive' } }, { tech_stack: { contains: q, mode: 'insensitive' } }] } : {}), ...(category ? { categories: { some: { category: { name: category } } } } : {}) }, select: { id: true, name: true, website_url: true, careerUrl: true, location: true, categories: { include: { category: { select: { name: true } } } }, candidate_company_state: { where: { candidate_id: candidateId }, select: { status: true, last_applied_at: true, reapply_count: true, notes: true } } }, orderBy: { name: 'asc' }, take: query.limit });
    return rows.map((row) => { const state = row.candidate_company_state[0]; return { id: row.id, name: row.name, websiteUrl: row.website_url, careerUrl: row.careerUrl, location: row.location, categories: row.categories.map((item) => item.category.name).filter((name) => name !== 'Other'), trackingStatus: state?.status ?? null, lastAppliedAt: state?.last_applied_at?.toISOString().slice(0, 10) ?? null, reapplyCount: state?.reapply_count ?? 0, notes: state?.notes ?? null }; });
  }
}
