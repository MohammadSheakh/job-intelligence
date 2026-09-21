/** Scoring inputs deliberately exclude identity, credentials, and persistence metadata. */
export interface CandidateForMatch {
  expertise?: string | null;
  skills?: string | null;
  experienceLevel?: string | null;
  preferredLocations?: string | null;
  excludedLocations?: string | null;
  preferredWorkModes?: string | null;
  preferredCategories?: string | null;
  excludedCategories?: string | null;
}

export interface JobForMatch {
  companyLocation?: string | null;
  companyTechStack?: string | null;
  companyCategories?: string[];
  companySectorCategories?: string[];
  title: string;
  description?: string | null;
  location?: string | null;
  workMode?: string | null;
  skills?: string | null;
  experience?: string | null;
}

export interface MatchBreakdown {
  expertise?: number;
  skills?: number;
  location?: number;
  experience?: number;
  workMode?: number;
  companyContextBonus?: number;
  preferredCategoryBonus?: number;
}

export interface MatchResult {
  eligible: boolean;
  deterministicScore: number;
  finalScore: number;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  matchedCompanyCategories: string[];
  matchedPreferredCategories: string[];
  reasons: string[];
  rejectionReason?: string;
  aiUsed: boolean;
}
