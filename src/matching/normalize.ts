const SKILL_ALIASES: Record<string, string> = {
  node: 'nodejs',
  'node js': 'nodejs',
  'node.js': 'nodejs',
  nodejs: 'nodejs',
  react: 'react',
  'react js': 'react',
  'react.js': 'react',
  reactjs: 'react',
  next: 'nextjs',
  'next js': 'nextjs',
  'next.js': 'nextjs',
  nextjs: 'nextjs',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  mongo: 'mongodb',
  mongodb: 'mongodb',
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  '.net': 'dotnet',
  dotnet: 'dotnet',
  'asp.net': 'dotnet',
  'c sharp': 'csharp',
  'c#': 'csharp',
  'amazon web services': 'aws',
  aws: 'aws',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  gcp: 'gcp',
};

export function normalizeText(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;|\n/]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

export function normalizeSkill(value: string): string {
  const normalized = normalizeText(value);
  return SKILL_ALIASES[normalized] ?? normalized.replace(/\s+/g, '');
}

export function skillList(value?: string | null): string[] {
  return [...new Set(splitList(value).map(normalizeSkill).filter(Boolean))];
}

export function containsNormalized(haystack?: string | null, needle?: string | null): boolean {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  return Boolean(h && n && (h.includes(n) || n.includes(h)));
}
