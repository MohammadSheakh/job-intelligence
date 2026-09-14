export type CategorySuggestion = {
  name: string;
  confidence: number;
  reason: string;
};

export type EnrichmentCompany = {
  id: string;
  name: string;
  websiteUrl: string | null;
  careerUrl: string | null;
  techStack: string | null;
  notes: string | null;
  statusResearchHint: string | null;
};

const TECHNOLOGY_RULES: Array<[RegExp, string]> = [
  [/\bnode(?:\.js|js)?\b/i, 'Node.js'],
  [/\bpython\b/i, 'Python'],
  [/\bdjango\b/i, 'Django'],
  [/\bphp\b/i, 'PHP'],
  [/\blaravel\b/i, 'Laravel'],
  [/(?:\bdot\s*net\b|\.net\b|\bdotnet\b)/i, '.NET'],
  [/\bjava\b/i, 'Java'],
  [/\breact(?:\.js|js)?\b/i, 'React'],
  [/\bnext(?:\.js|js)?\b/i, 'Next.js'],
  [/\bvue(?:\.js|js)?\b/i, 'Vue.js'],
  [/\bflutter\b/i, 'Flutter'],
  [/\bwordpress\b/i, 'WordPress'],
  [/\bjoomla\b/i, 'Joomla'],
  [/\bodoo\b|\berp\b/i, 'Odoo/ERP'],
];

const DOMAIN_RULES: Array<[RegExp, string]> = [
  [/\bback[ -]?end\b/i, 'Backend'],
  [/\bfront[ -]?end\b/i, 'Frontend'],
  [/\bfull[ -]?stack\b/i, 'Full Stack'],
  [/\bcyber\s*security\b|\bcybersecurity\b|\binformation security\b/i, 'Cybersecurity'],
  [/\bmachine learning\b|\bml\b/i, 'Machine Learning'],
  [/\bartificial intelligence\b|\bai\b/i, 'AI'],
  [/\bdata analytics?\b|\banalytics\b/i, 'Data Analytics'],
  [/\bdata science\b/i, 'Data Science'],
  [/\bdata engineer(?:ing)?\b/i, 'Data Engineering'],
  [/\bdevops\b|\bkubernetes\b|\bcloud native\b|\bcloud\b/i, 'DevOps/Cloud'],
  [/\bqa\b|\bsqa\b|quality assurance/i, 'QA/SQA'],
  [/\bui\/?ux\b|\bux\/?ui\b/i, 'UI/UX'],
  [/\bbiometric(?:s)?\b|identity management/i, 'Identity/Biometrics'],
];

const SECTOR_RULES: Array<[RegExp, string]> = [
  [/\bfintech\b|\bbank(?:ing)?\b/i, 'Bank/Fintech'],
  [/\bngo\b|development organization/i, 'NGO/Development'],
  [/\bbpo\b|contact center|call center/i, 'BPO/Contact Center'],
  [/\btelecom\b|\bisp\b/i, 'Telecom/ISP'],
  [/\be-?commerce\b|\becommerce\b/i, 'E-commerce'],
  [/\bedtech\b|e-learning|online learning|education platform/i, 'EdTech'],
  [/\blogistics\b|delivery network|parcel delivery|last-mile/i, 'Logistics'],
  [/\bagritech\b|digital agriculture|agri-value|farmers?/i, 'AgriTech'],
  [/\bsaas\b|software product company/i, 'SaaS/Product'],
];

// High-confidence identities researched/verified from public company websites.
const EXACT_COMPANY_RULES: Record<string, string[]> = {
  wpdeveloper: ['WordPress', 'SaaS/Product'],
  authlab: ['WordPress', 'SaaS/Product'],
  radiustheme: ['WordPress', 'SaaS/Product'],
  joomshaper: ['Joomla', 'SaaS/Product'],
  appscode: ['DevOps/Cloud', 'SaaS/Product'],
  lead: ['EdTech'],
  bohubrihi: ['EdTech'],
  ostad: ['EdTech'],
  shopup: ['E-commerce', 'Logistics'],
  ifarmer: ['AgriTech'],
  pathao: ['Logistics', 'E-commerce', 'Bank/Fintech'],
  redx: ['Logistics'],
  paperfly: ['Logistics'],
  'tigerit bangladesh': ['Cybersecurity', 'Identity/Biometrics'],
};

function normalizedName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function suggestCategories(company: EnrichmentCompany): CategorySuggestion[] {
  const suggestions = new Map<string, CategorySuggestion>();
  const add = (name: string, confidence: number, reason: string) => {
    const current = suggestions.get(name);
    if (!current || confidence > current.confidence) suggestions.set(name, { name, confidence, reason });
  };

  const exact = EXACT_COMPANY_RULES[normalizedName(company.name)];
  if (exact) for (const name of exact) add(name, 0.99, 'verified company identity rule');

  const text = [
    company.name,
    company.websiteUrl ?? '',
    company.careerUrl ?? '',
    company.techStack ?? '',
    company.notes ?? '',
    company.statusResearchHint ?? '',
  ].join(' | ');

  // Existing research text is strong enough for explicit technology/domain words.
  for (const [pattern, category] of TECHNOLOGY_RULES) if (pattern.test(text)) add(category, 0.92, `explicit keyword: ${pattern.source}`);
  for (const [pattern, category] of DOMAIN_RULES) if (pattern.test(text)) add(category, 0.88, `explicit domain keyword: ${pattern.source}`);
  for (const [pattern, category] of SECTOR_RULES) if (pattern.test(text)) add(category, 0.86, `explicit sector keyword: ${pattern.source}`);

  return [...suggestions.values()].sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}
