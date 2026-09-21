export interface DatabaseConfig {
  url: string;
}
/** Require an explicit database URL without creating connections or changing database mode. */
export function databaseConfig(): DatabaseConfig {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return { url };
}
