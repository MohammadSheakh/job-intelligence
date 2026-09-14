import { db } from '../db.js';
import type { CandidateForMatch } from '../matching/types.js';

interface CandidateRow {
  id: string | number;
  name: string;
  email: string;
  expertise: string | null;
  skills: string | null;
  experience_level: string | null;
  preferred_locations: string | null;
  excluded_locations: string | null;
  preferred_work_modes: string | null;
  preferred_categories: string | null;
  excluded_categories: string | null;
  minimum_match_score: number;
}

function mapCandidate(row: CandidateRow): CandidateForMatch {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    expertise: row.expertise,
    skills: row.skills,
    experienceLevel: row.experience_level,
    preferredLocations: row.preferred_locations,
    excludedLocations: row.excluded_locations,
    preferredWorkModes: row.preferred_work_modes,
    preferredCategories: row.preferred_categories,
    excludedCategories: row.excluded_categories,
    minimumMatchScore: row.minimum_match_score,
  };
}

export async function getActiveCandidates(): Promise<CandidateForMatch[]> {
  const result = await db.query<CandidateRow>(`
    SELECT id, name, email, expertise, skills, experience_level,
           preferred_locations, excluded_locations, preferred_work_modes,
           preferred_categories, excluded_categories, minimum_match_score
    FROM candidates
    WHERE active = true
    ORDER BY id
  `);
  return result.rows.map(mapCandidate);
}

export interface UpsertCandidateInput {
  name: string;
  email: string;
  expertise?: string;
  skills?: string;
  experienceLevel?: string;
  preferredLocations?: string;
  excludedLocations?: string;
  preferredWorkModes?: string;
  preferredCategories?: string;
  excludedCategories?: string;
  minimumMatchScore?: number;
}

export async function upsertCandidate(input: UpsertCandidateInput): Promise<number> {
  const result = await db.query<{ id: string | number }>(`
    INSERT INTO candidates (
      name, email, expertise, skills, experience_level,
      preferred_locations, excluded_locations, preferred_work_modes,
      preferred_categories, excluded_categories, minimum_match_score, active, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,now())
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      expertise = EXCLUDED.expertise,
      skills = EXCLUDED.skills,
      experience_level = EXCLUDED.experience_level,
      preferred_locations = EXCLUDED.preferred_locations,
      excluded_locations = EXCLUDED.excluded_locations,
      preferred_work_modes = EXCLUDED.preferred_work_modes,
      preferred_categories = EXCLUDED.preferred_categories,
      excluded_categories = EXCLUDED.excluded_categories,
      minimum_match_score = EXCLUDED.minimum_match_score,
      active = true,
      updated_at = now()
    RETURNING id
  `, [
    input.name,
    input.email.toLowerCase().trim(),
    input.expertise ?? null,
    input.skills ?? null,
    input.experienceLevel ?? null,
    input.preferredLocations ?? null,
    input.excludedLocations ?? null,
    input.preferredWorkModes ?? null,
    input.preferredCategories ?? null,
    input.excludedCategories ?? null,
    input.minimumMatchScore ?? 70,
  ]);
  return Number(result.rows[0].id);
}

export async function getActiveCandidateById(candidateId: number): Promise<CandidateForMatch | null> {
  const result = await db.query<CandidateRow>(`
    SELECT id, name, email, expertise, skills, experience_level,
           preferred_locations, excluded_locations, preferred_work_modes,
           preferred_categories, excluded_categories, minimum_match_score
    FROM candidates
    WHERE id=$1 AND active=true
    LIMIT 1
  `, [candidateId]);
  return result.rows[0] ? mapCandidate(result.rows[0]) : null;
}
