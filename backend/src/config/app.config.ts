export interface AppConfig { apiPort: number; cookieSecure: boolean; adminUsername: string; adminPassword: string; defaultCandidatePassword: string; }

export function appConfig(): AppConfig {
  return {
    apiPort: Number(process.env.API_PORT ?? 4000),
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    adminUsername: process.env.ADMIN_USERNAME ?? '',
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
    defaultCandidatePassword: process.env.DEFAULT_CANDIDATE_PASSWORD ?? 'asdfasdf',
  };
}
