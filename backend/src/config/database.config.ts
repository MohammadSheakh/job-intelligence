export interface DatabaseConfig {
  url: string;
}
export function databaseConfig(): DatabaseConfig {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return { url };
}
