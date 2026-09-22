import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { UpdateCandidateProfileDto } from '../dto/update-candidate-profile.dto.js';

/**
 * Reads and updates self-service profile fields without exposing password data or changing login
 * identity.
 */
@Injectable()
export class CandidateProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Project only editable profile data and the read-only email for an active candidate. */
  async get(candidateId: bigint) {
    const profile = await this.prisma.candidate.findFirst({
      where: { id: candidateId, active: true },
      select: {
        name: true,
        email: true,
        expertise: true,
        skills: true,
        experience_level: true,
        experience_years: true,
        preferred_locations: true,
        excluded_locations: true,
        preferred_work_modes: true,
        preferred_categories: true,
        excluded_categories: true,
        minimum_match_score: true,
      },
    });
    if (!profile)
      throw new NotFoundException({
        code: 'CANDIDATE_PROFILE_NOT_FOUND',
        message: 'Candidate profile was not found.',
      });
    return profile;
  }

  /**
   * Normalize profile values against the category catalog; exclusions override preferences and
   * unknown categories are discarded.
   */
  async update(candidateId: bigint, input: UpdateCandidateProfileDto): Promise<void> {
    const clean = (value: string | undefined) => value?.trim().replace(/\s+/g, ' ') || null;
    const allowedCategories = new Set(
      (
        await this.prisma.category.findMany({
          where: { name: { not: 'Other' } },
          select: { name: true },
        })
      ).map((category) => category.name),
    );
    const excluded = [
      ...new Set((input.excludedCategories ?? []).filter((name) => allowedCategories.has(name))),
    ];
    const excludedSet = new Set(excluded);
    const preferred = [
      ...new Set(
        (input.preferredCategories ?? []).filter(
          (name) => allowedCategories.has(name) && !excludedSet.has(name),
        ),
      ),
    ];
    const result = await this.prisma.candidate.updateMany({
      where: { id: candidateId, active: true },
      data: {
        name: clean(input.name) ?? '',
        expertise: clean(input.expertise),
        skills: clean(input.skills),
        experience_level: clean(input.experienceLevel),
        experience_years: input.experienceYears ?? null,
        preferred_locations: clean(input.preferredLocations),
        excluded_locations: clean(input.excludedLocations),
        preferred_work_modes: [...new Set(input.preferredWorkModes ?? [])].join(', ') || null,
        preferred_categories: preferred.join(', ') || null,
        excluded_categories: excluded.join(', ') || null,
        minimum_match_score: input.minimumMatchScore,
      },
    });
    if (result.count !== 1)
      throw new NotFoundException({
        code: 'CANDIDATE_PROFILE_NOT_FOUND',
        message: 'Candidate profile was not found.',
      });
  }
}
