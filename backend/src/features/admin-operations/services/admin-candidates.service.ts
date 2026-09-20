import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { AppConfigService } from '../../../config/config.service.js';
import { CandidateAuthenticationService } from '../../authentication/services/candidate-authentication.service.js';
import { SaveCandidateDto } from '../dto/save-candidate.dto.js';

@Injectable()
export class AdminCandidatesService {
  constructor(private readonly prisma: PrismaService, private readonly config: AppConfigService, private readonly authentication: CandidateAuthenticationService) {}

  async list() {
    const candidates = await this.prisma.candidate.findMany({ include: { auth: { select: { passwordHash: true, google_sub: true } } }, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
    return candidates.map((candidate) => this.toResponse(candidate));
  }

  async get(id: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: this.id(id) }, include: { auth: { select: { passwordHash: true, google_sub: true } } } });
    if (!candidate) throw new NotFoundException({ code: 'CANDIDATE_NOT_FOUND', message: 'Candidate was not found.' });
    return this.toResponse(candidate);
  }

  async create(input: SaveCandidateDto): Promise<{ id: string }> {
    const candidate = await this.save(input);
    await this.ensurePassword(candidate.id, input.newPassword);
    return { id: candidate.id.toString() };
  }

  async update(id: string, input: SaveCandidateDto): Promise<void> {
    const candidateId = this.id(id);
    const candidate = await this.save(input, candidateId);
    if (input.newPassword) await this.authentication.setPassword(candidate.id, input.newPassword, true);
    else await this.ensurePassword(candidate.id);
  }

  private async save(input: SaveCandidateDto, id?: bigint) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException({ code: 'CANDIDATE_NAME_REQUIRED', message: 'Candidate name is required.' });
    const email = input.email.trim().toLowerCase();
    const clean = (value: string | undefined) => value?.trim() || null;
    const excluded = [...new Set(input.excludedCategories.map((value) => value.trim()).filter(Boolean))];
    const excludedSet = new Set(excluded);
    const preferred = [...new Set(input.preferredCategories.map((value) => value.trim()).filter((value) => value && !excludedSet.has(value)))];
    const data = { name, email, expertise: clean(input.expertise), skills: clean(input.skills), experience_level: clean(input.experienceLevel), preferred_locations: clean(input.preferredLocations), excluded_locations: clean(input.excludedLocations), preferred_work_modes: [...new Set(input.preferredWorkModes ?? [])].join(', ') || null, preferred_categories: preferred.join(', ') || null, excluded_categories: excluded.join(', ') || null, minimum_match_score: input.minimumMatchScore, active: input.active, updated_at: new Date() };
    try {
      if (id) {
        const result = await this.prisma.candidate.updateMany({ where: { id }, data });
        if (result.count !== 1) throw new NotFoundException({ code: 'CANDIDATE_NOT_FOUND', message: 'Candidate was not found.' });
        return { id };
      }
      return await this.prisma.candidate.create({ data, select: { id: true } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException({ code: 'CANDIDATE_EMAIL_EXISTS', message: 'A candidate already uses this email address.' });
      throw error;
    }
  }

  private async ensurePassword(candidateId: bigint, explicit?: string): Promise<void> {
    if (explicit) { await this.authentication.setPassword(candidateId, explicit, true); return; }
    const auth = await this.prisma.candidateAuth.findUnique({ where: { candidateId }, select: { passwordHash: true } });
    if (!auth?.passwordHash) await this.authentication.setPassword(candidateId, this.config.app.defaultCandidatePassword, true);
  }

  private id(value: string): bigint { try { return BigInt(value); } catch { throw new BadRequestException({ code: 'INVALID_CANDIDATE_ID', message: 'Candidate ID is invalid.' }); } }
  private toResponse(candidate: { id: bigint; name: string; email: string; expertise: string | null; skills: string | null; experience_level: string | null; preferred_locations: string | null; excluded_locations: string | null; preferred_work_modes: string | null; preferred_categories: string | null; excluded_categories: string | null; minimum_match_score: number; active: boolean; auth: { passwordHash: string | null; google_sub: string | null } | null }) { return { id: candidate.id.toString(), name: candidate.name, email: candidate.email, expertise: candidate.expertise, skills: candidate.skills, experienceLevel: candidate.experience_level, preferredLocations: candidate.preferred_locations, excludedLocations: candidate.excluded_locations, preferredWorkModes: candidate.preferred_work_modes, preferredCategories: candidate.preferred_categories, excludedCategories: candidate.excluded_categories, minimumMatchScore: candidate.minimum_match_score, active: candidate.active, hasPassword: Boolean(candidate.auth?.passwordHash), hasGoogle: Boolean(candidate.auth?.google_sub) }; }
}
