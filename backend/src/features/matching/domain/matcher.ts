import type { CandidateForMatch, JobForMatch, MatchBreakdown, MatchResult } from './types.js';
import { containsNormalized, normalizeText, skillList, splitList } from './normalize.js';

const WEIGHTS = {
  expertise: 35,
  skills: 35,
  location: 15,
  experience: 10,
  workMode: 5,
} as const;

const NON_CONTEXT_TITLE_RE =
  /\b(sales|marketing|finance|accounts?|accounting|human resources|hr|recruiter|talent|business development|partnerships?|customer service|operations?|administration|administrator|procurement|legal)\b/;

const CATEGORY_ALIASES: Record<string, string[]> = {
  'node.js': ['node', 'node js', 'node.js', 'nodejs'],
  nestjs: ['nestjs', 'nest js', 'nest.js'],
  '.net': ['.net', 'dotnet', 'asp.net', 'c#', 'c sharp'],
  php: ['php'],
  laravel: ['laravel'],
  django: ['django'],
  python: ['python'],
  java: ['java', 'spring', 'spring boot'],
  react: ['react', 'reactjs', 'react.js'],
  'next.js': ['next', 'nextjs', 'next.js'],
  'vue.js': ['vue', 'vuejs', 'vue.js'],
  flutter: ['flutter'],
  wordpress: ['wordpress', 'wp developer', 'wpdeveloper'],
  joomla: ['joomla'],
  'odoo erp': ['odoo', 'erp'],
  backend: [
    'backend',
    'back end',
    'server side',
    'node.js',
    'nodejs',
    'django',
    'laravel',
    'spring boot',
    'php',
    'dotnet',
  ],
  frontend: ['frontend', 'front end', 'react', 'vue', 'angular', 'nextjs'],
  'full stack': ['full stack', 'fullstack', 'mern', 'mean'],
  ai: ['ai', 'artificial intelligence', 'generative ai', 'llm'],
  'machine learning': ['machine learning', 'ml engineer', 'deep learning'],
  'data analytics': ['data analytics', 'data analyst', 'analytics'],
  'data engineering': ['data engineer', 'data engineering'],
  'data science': ['data science', 'data scientist'],
  cybersecurity: [
    'cybersecurity',
    'cyber security',
    'security engineer',
    'soc analyst',
    'penetration testing',
  ],
  networking: ['networking', 'network engineer', 'network administrator'],
  'devops cloud': [
    'devops',
    'cloud',
    'sre',
    'site reliability',
    'aws',
    'azure',
    'gcp',
    'kubernetes',
  ],
  'qa sqa': ['qa', 'sqa', 'quality assurance', 'test engineer', 'tester'],
  'ui ux': ['ui ux', 'ux designer', 'ui designer', 'product designer'],
  'embedded iot': ['embedded', 'iot', 'internet of things'],
  'ar vr': ['ar', 'vr', 'augmented reality', 'virtual reality'],
  'bank fintech': ['fintech', 'banking', 'bank', 'financial technology'],
  'ngo development': ['ngo', 'development sector', 'nonprofit', 'non profit'],
  'bpo contact center': ['bpo', 'contact center', 'call center', 'customer service'],
  'telecom isp': ['telecom', 'telecommunications', 'isp'],
  'e commerce': ['ecommerce', 'e commerce', 'marketplace'],
  edtech: ['edtech', 'education technology', 'e learning', 'elearning'],
  healthtech: ['healthtech', 'health tech', 'healthcare technology'],
  logistics: ['logistics', 'delivery', 'courier', 'last mile'],
  agritech: ['agritech', 'agriculture technology', 'agriculture'],
  'saas product': ['saas', 'software as a service', 'product company', 'product engineering'],
  'identity biometrics': ['identity', 'biometrics', 'biometric'],
};

function detectFamily(text: string): string | null {
  const t = normalizeText(text);
  const rules: Array<[string, RegExp]> = [
    [
      'backend',
      /\b(back ?end|server ?side|node|nest|django|spring|laravel|php|java|asp\.net|dotnet|c#)\b/,
    ],
    ['frontend', /\b(front ?end|react|angular|vue|ui developer)\b/],
    ['fullstack', /\b(full ?stack|mern|mean)\b/],
    ['mobile', /\b(android|ios|flutter|react native|mobile)\b/],
    ['qa', /\b(qa|quality assurance|sqa|test engineer|tester)\b/],
    ['devops', /\b(devops|sre|site reliability|cloud engineer|platform engineer)\b/],
    ['data', /\b(data engineer|data analyst|data scientist|analytics)\b/],
    ['ml', /\b(machine learning|ml engineer|ai engineer|artificial intelligence)\b/],
    ['security', /\b(cyber|security|soc analyst|penetration)\b/],
    ['design', /\b(ui ux|ux|ui designer|product designer)\b/],
    ['product', /\b(product manager|product owner)\b/],
    ['business-analysis', /\b(business analyst|ba)\b/],
    ['support', /\b(technical support|support engineer|it support)\b/],
  ];
  for (const [family, re] of rules) if (re.test(t)) return family;
  return null;
}

function expertiseScore(candidate: CandidateForMatch, job: JobForMatch): number | undefined {
  if (!candidate.expertise) return undefined;
  const candidateFamily = detectFamily(candidate.expertise);
  const jobFamily = detectFamily(`${job.title} ${job.description ?? ''}`);
  if (candidateFamily && jobFamily) return candidateFamily === jobFamily ? 100 : 15;

  const candidateWords = new Set(
    normalizeText(candidate.expertise)
      .split(' ')
      .filter((w) => w.length > 2),
  );
  const jobText = normalizeText(`${job.title} ${job.description ?? ''}`);
  if (!candidateWords.size || !jobText) return undefined;
  const matched = [...candidateWords].filter((word) => jobText.includes(word)).length;
  return Math.round((matched / candidateWords.size) * 100);
}

/** Retain the legacy job-plus-company skill signal so migration does not silently rerank results. */
function skillsScore(
  candidate: CandidateForMatch,
  job: JobForMatch,
): { score?: number; matched: string[] } {
  const candidateSkills = skillList(candidate.skills);
  if (!candidateSkills.length) return { matched: [] };
  const jobSignal = [job.skills, job.description, job.title, job.companyTechStack]
    .filter(Boolean)
    .join(' ');
  if (!jobSignal.trim()) return { matched: [] };

  const compactJobSignal = normalizeText(jobSignal).replace(/[^a-z0-9+#]+/g, '');
  const matched = candidateSkills.filter((skill) =>
    compactJobSignal.includes(skill.replace(/[^a-z0-9+#]+/g, '')),
  );
  return {
    score: Math.round((matched.length / candidateSkills.length) * 100),
    matched,
  };
}

/** Explicit location exclusions take priority over preferred-location points. */
function locationScore(
  candidate: CandidateForMatch,
  job: JobForMatch,
): { score?: number; rejected?: string } {
  const location = job.location || job.companyLocation;
  if (!location) return {};

  const excluded = splitList(candidate.excludedLocations);
  const excludedHit = excluded.find((item) => containsNormalized(location, item));
  if (excludedHit) return { rejected: `Excluded location matched: ${excludedHit}` };

  const preferred = splitList(candidate.preferredLocations);
  if (!preferred.length) return {};
  const preferredHit = preferred.find((item) => containsNormalized(location, item));
  return { score: preferredHit ? 100 : 35 };
}

function experienceScore(candidate: CandidateForMatch, job: JobForMatch): number | undefined {
  if (!candidate.experienceLevel) return undefined;
  const jobText = normalizeText(`${job.title} ${job.experience ?? ''} ${job.description ?? ''}`);
  if (!jobText) return undefined;

  const levels = ['intern', 'junior', 'mid', 'senior', 'lead'];
  const candidateLevel = levels.find((level) =>
    normalizeText(candidate.experienceLevel).includes(level),
  );
  const jobLevel = levels.find((level) => jobText.includes(level));
  if (!candidateLevel || !jobLevel) return undefined;
  if (candidateLevel === jobLevel) return 100;
  const c = levels.indexOf(candidateLevel);
  const j = levels.indexOf(jobLevel);
  return Math.abs(c - j) === 1 ? 65 : 20;
}

function workModeScore(
  candidate: CandidateForMatch,
  job: JobForMatch,
): { score?: number; rejected?: string } {
  if (!job.workMode) return {};
  const preferred = splitList(candidate.preferredWorkModes);
  if (!preferred.length) return {};
  const matched = preferred.some((mode) => containsNormalized(job.workMode, mode));
  if (matched) return { score: 100 };
  return { rejected: `Work mode not preferred: ${job.workMode}` };
}

/** Match complete normalized phrases so short labels such as AI do not match inside words. */
function categoryMatchesSignal(category: string, signal: string): boolean {
  const normalizedCategory = normalizeText(category);
  if (!normalizedCategory || normalizedCategory === 'other') return false;

  const aliases = CATEGORY_ALIASES[normalizedCategory] ?? [normalizedCategory];
  const paddedSignal = ` ${signal} `;
  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return Boolean(normalizedAlias && paddedSignal.includes(` ${normalizedAlias} `));
  });
}

/** Cap sparse company context and suppress it for unrelated job families and business titles. */
function companyContext(
  candidate: CandidateForMatch,
  job: JobForMatch,
): { bonus: number; matched: string[] } {
  const normalizedTitle = normalizeText(job.title);
  if (NON_CONTEXT_TITLE_RE.test(normalizedTitle)) return { bonus: 0, matched: [] };

  const candidateFamily = detectFamily(`${candidate.expertise ?? ''} ${candidate.skills ?? ''}`);
  const jobFamily = detectFamily(`${job.title} ${job.description ?? ''}`);
  if (candidateFamily && jobFamily && candidateFamily !== jobFamily)
    return { bonus: 0, matched: [] };

  const categories = (job.companyCategories ?? []).filter(
    (category) => normalizeText(category) !== 'other',
  );
  if (!categories.length) return { bonus: 0, matched: [] };

  const candidateSignal = normalizeText(`${candidate.expertise ?? ''} ${candidate.skills ?? ''}`);
  if (!candidateSignal) return { bonus: 0, matched: [] };

  const matched = categories.filter((category) => categoryMatchesSignal(category, candidateSignal));
  if (!matched.length) return { bonus: 0, matched: [] };

  const hasRichJobData =
    Boolean(job.skills?.trim()) || (job.description?.trim().length ?? 0) >= 120;
  const perMatch = hasRichJobData ? 2 : 4;
  const maxBonus = hasRichJobData ? 4 : 8;
  return {
    bonus: Math.min(maxBonus, matched.length * perMatch),
    matched,
  };
}

function categoryPreferenceList(value?: string | null): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(/[,;|\n]+/)
        .map(normalizeText)
        .filter(Boolean),
    ),
  ];
}

/** Sector exclusions use company identity; technology/domain exclusions require job evidence. */
function candidateCategoryPreferences(
  candidate: CandidateForMatch,
  job: JobForMatch,
): { bonus: number; matched: string[]; rejected?: string } {
  const preferred = categoryPreferenceList(candidate.preferredCategories);
  const excluded = categoryPreferenceList(candidate.excludedCategories);
  if (!preferred.length && !excluded.length) return { bonus: 0, matched: [] };

  const companyCategories = new Set(
    (job.companyCategories ?? []).map(normalizeText).filter(Boolean),
  );
  const companySectors = new Set(
    (job.companySectorCategories ?? []).map(normalizeText).filter(Boolean),
  );
  const jobSignal = normalizeText(
    [job.title, job.description, job.skills].filter(Boolean).join(' '),
  );

  for (const category of excluded) {
    if (companySectors.has(category)) {
      return { bonus: 0, matched: [], rejected: `Excluded sector/category matched: ${category}` };
    }
    if (categoryMatchesSignal(category, jobSignal)) {
      return { bonus: 0, matched: [], rejected: `Excluded job category matched: ${category}` };
    }
  }

  const businessTitle = NON_CONTEXT_TITLE_RE.test(normalizeText(job.title));
  const matched: string[] = [];
  let bonus = 0;
  for (const category of preferred) {
    const explicitJobMatch = categoryMatchesSignal(category, jobSignal);
    const companyMatch = companyCategories.has(category);
    const sectorMatch = companySectors.has(category);
    if (explicitJobMatch) {
      matched.push(category);
      bonus += 5;
    } else if (sectorMatch) {
      matched.push(category);
      bonus += 4;
    } else if (companyMatch && !businessTitle) {
      matched.push(category);
      bonus += 2;
    }
  }
  return { bonus: Math.min(8, bonus), matched: [...new Set(matched)] };
}

function rejectedResult(reason: string): MatchResult {
  return {
    eligible: false,
    deterministicScore: 0,
    finalScore: 0,
    breakdown: {},
    matchedSkills: [],
    matchedCompanyCategories: [],
    matchedPreferredCategories: [],
    reasons: [],
    rejectionReason: reason,
    aiUsed: false,
  };
}

/** Preserve legacy weights and hard exclusions; callers apply the candidate threshold afterward. */
export function deterministicMatch(candidate: CandidateForMatch, job: JobForMatch): MatchResult {
  const location = locationScore(candidate, job);
  if (location.rejected) return rejectedResult(location.rejected);

  const workMode = workModeScore(candidate, job);
  if (workMode.rejected) return rejectedResult(workMode.rejected);

  const categoryPreferences = candidateCategoryPreferences(candidate, job);
  if (categoryPreferences.rejected) return rejectedResult(categoryPreferences.rejected);

  const expertise = expertiseScore(candidate, job);
  const skills = skillsScore(candidate, job);
  const experience = experienceScore(candidate, job);

  const breakdown: MatchBreakdown = {};
  const weighted: Array<[keyof typeof WEIGHTS, number | undefined]> = [
    ['expertise', expertise],
    ['skills', skills.score],
    ['location', location.score],
    ['experience', experience],
    ['workMode', workMode.score],
  ];

  let points = 0;
  let availableWeight = 0;
  for (const [key, value] of weighted) {
    if (value === undefined) continue;
    breakdown[key] = value;
    points += WEIGHTS[key] * (value / 100);
    availableWeight += WEIGHTS[key];
  }

  const baseScore = availableWeight > 0 ? Math.round((points / availableWeight) * 100) : 0;
  const context = companyContext(candidate, job);
  if (context.bonus > 0) breakdown.companyContextBonus = context.bonus;
  const remainingContextRoom = Math.max(0, 12 - context.bonus);
  const preferredCategoryBonus = Math.min(categoryPreferences.bonus, remainingContextRoom);
  if (preferredCategoryBonus > 0) breakdown.preferredCategoryBonus = preferredCategoryBonus;
  const deterministicScore = Math.min(100, baseScore + context.bonus + preferredCategoryBonus);

  const reasons: string[] = [];
  if (expertise !== undefined && expertise >= 70)
    reasons.push('Expertise is closely aligned with the role');
  if (skills.matched.length) reasons.push(`Matched skills: ${skills.matched.join(', ')}`);
  if (context.matched.length)
    reasons.push(`Company context matches: ${context.matched.join(', ')}`);
  if (categoryPreferences.matched.length)
    reasons.push(`Preferred categories matched: ${categoryPreferences.matched.join(', ')}`);
  if (location.score === 100) reasons.push('Preferred location matched');
  if (experience !== undefined && experience >= 65) reasons.push('Experience level is compatible');
  if (workMode.score === 100) reasons.push('Preferred work mode matched');

  return {
    eligible: true,
    deterministicScore,
    finalScore: deterministicScore,
    breakdown,
    matchedSkills: skills.matched,
    matchedCompanyCategories: context.matched,
    matchedPreferredCategories: categoryPreferences.matched,
    reasons,
    aiUsed: false,
  };
}
