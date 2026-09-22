export const CONTROLLED_EXPERIENCE_LEVELS = [
  'Student/Intern',
  'Fresher/Entry',
  'Junior',
  'Mid',
  'Senior',
  'Lead/Principal',
  'Manager',
] as const;

export type ExperienceLevel = (typeof CONTROLLED_EXPERIENCE_LEVELS)[number];

export interface CandidateAdminRecord {
  id: string;
  name: string;
  email: string;
  expertise: string | null;
  skills: string | null;
  experienceLevel: string | null;
  experienceYears?: number | null;
  preferredLocations: string | null;
  excludedLocations: string | null;
  preferredWorkModes: string | null;
  preferredCategories: string | null;
  excludedCategories: string | null;
  minimumMatchScore: number;
  active: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
}

export interface SaveCandidatePayload {
  name: string;
  email: string;
  expertise?: string;
  skills?: string;
  experienceLevel?: string;
  experienceYears?: number | null;
  preferredLocations?: string;
  excludedLocations?: string;
  preferredWorkModes?: string[];
  preferredCategories: string[];
  excludedCategories: string[];
  minimumMatchScore: number;
  active: boolean;
  newPassword?: string;
}
