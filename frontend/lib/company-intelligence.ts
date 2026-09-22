export const companyActions = [
  ['MONITOR_READY', 'Monitor ready'],
  ['FIND_CAREER_PAGE', 'Find career page'],
  ['NO_HIRING_PAGE_FOUND', 'No hiring page found'],
  ['ENRICH_FROM_LINKEDIN', 'Enrich from LinkedIn'],
  ['MANUAL_REVIEW', 'Manual review'],
] as const;

export interface Category {
  id: string;
  name: string;
  type: 'technology' | 'domain' | 'sector' | 'other';
  companyCount: number;
}

export interface Company {
  id: string;
  name: string;
  websiteUrl: string | null;
  careerUrl: string | null;
  linkedinUrl: string | null;
  email: string | null;
  location: string | null;
  techStack: string | null;
  active: boolean;
  recommendedAction: string | null;
  needsManualReview: boolean;
  reviewReasons?: string | null;
  lastCheckedAt: string | null;
  categories: string[];
}

export interface CompanyDetail extends Company {
  notes: string | null;
  statusResearchHint: string | null;
  reviewReasons: string | null;
  needsEnrichment: boolean;
  enrichmentReasons: string | null;
  sourceRows: string | null;
  nameSource: string | null;
}

export interface CompanyPage {
  rows: Company[];
  total: number;
  page: number;
  pageSize: number;
}
