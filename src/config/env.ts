const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function text(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

function int(name: string, fallback: number, min?: number, max?: number): number {
  const raw = text(name);
  const parsed = raw ? Number(raw) : fallback;
  const value = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  return Math.max(min ?? value, Math.min(max ?? value, value));
}

function bool(name: string, fallback = false): boolean {
  const raw = text(name);
  if (!raw) return fallback;
  return TRUE_VALUES.has(raw.toLowerCase());
}

export const env = {
  databaseUrl: text('DATABASE_URL'),
  databaseMode: text('DATABASE_MODE', 'unknown').toLowerCase(),
  adminHost: text('ADMIN_HOST', '127.0.0.1'),
  adminPort: int('ADMIN_PORT', 3000, 1, 65535),
  adminUsername: text('ADMIN_USERNAME'),
  adminPassword: text('ADMIN_PASSWORD'),
  publicBaseUrl: text('PUBLIC_BASE_URL', 'http://127.0.0.1:3000'),
  candidateSessionSecret: text('CANDIDATE_SESSION_SECRET'),
  candidateSessionDays: int('CANDIDATE_SESSION_DAYS', 30, 1, 365),
  cookieSecure: bool('COOKIE_SECURE', false),
  defaultCandidatePassword: text('DEFAULT_CANDIDATE_PASSWORD', 'asdfasdf'),
  googleClientId: text('GOOGLE_CLIENT_ID'),
  googleClientSecret: text('GOOGLE_CLIENT_SECRET'),
  aiBaseUrl: text('AI_BASE_URL', 'http://localhost:11434/v1'),
  aiModel: text('AI_MODEL'),
  aiApiKey: text('AI_API_KEY'),
  smtpHost: text('SMTP_HOST', 'smtp.gmail.com'),
  smtpPort: int('SMTP_PORT', 587, 1, 65535),
  smtpSecure: bool('SMTP_SECURE', false),
  smtpUser: text('SMTP_USER'),
  smtpPass: text('SMTP_PASS'),
  emailFrom: text('EMAIL_FROM'),
};

export function environmentProblems(mode: 'server' | 'worker' | 'all' = 'all'): string[] {
  const problems: string[] = [];
  if (!env.databaseUrl) problems.push('DATABASE_URL is missing.');
  if (!['local', 'neon', 'unknown'].includes(env.databaseMode))
    problems.push('DATABASE_MODE must be local, neon, or unknown.');

  if (mode !== 'worker') {
    if (!env.adminUsername) problems.push('ADMIN_USERNAME is missing.');
    if (!env.adminPassword) problems.push('ADMIN_PASSWORD is missing.');
    if (env.adminPassword === 'change-me')
      problems.push('ADMIN_PASSWORD still uses the placeholder value change-me.');
    if (!env.candidateSessionSecret) problems.push('CANDIDATE_SESSION_SECRET is missing.');
    if (env.candidateSessionSecret && env.candidateSessionSecret.length < 32)
      problems.push('CANDIDATE_SESSION_SECRET must be at least 32 characters.');
    if (env.defaultCandidatePassword.length < 8)
      problems.push('DEFAULT_CANDIDATE_PASSWORD must be at least 8 characters.');
  }

  if (
    (env.googleClientId && !env.googleClientSecret) ||
    (!env.googleClientId && env.googleClientSecret)
  ) {
    problems.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.');
  }
  return problems;
}

export function assertEnvironment(mode: 'server' | 'worker' | 'all' = 'all'): void {
  const problems = environmentProblems(mode);
  if (problems.length)
    throw new Error(`Environment configuration error:\n- ${problems.join('\n- ')}`);
}
