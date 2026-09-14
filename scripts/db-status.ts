import 'dotenv/config';
import { db, closeDb } from '../src/db.js';
import { env } from '../src/config/env.js';

function inferredProvider(host: string): string {
  const h = host.toLowerCase();
  if (h === 'db' || h === 'localhost' || h === '127.0.0.1') return 'local';
  if (h.includes('neon.tech')) return 'neon';
  return env.databaseMode || 'unknown';
}

try {
  const result = await db.query<{
    database_name: string;
    server_addr: string | null;
    server_port: number | null;
    companies: string;
    candidates: string;
    jobs: string;
  }>(`
    SELECT current_database() AS database_name,
           inet_server_addr()::text AS server_addr,
           inet_server_port() AS server_port,
           (SELECT count(*)::text FROM companies) AS companies,
           (SELECT count(*)::text FROM candidates) AS candidates,
           (SELECT count(*)::text FROM jobs) AS jobs
  `);
  const row = result.rows[0];
  const url = new URL(env.databaseUrl);
  const provider = inferredProvider(url.hostname);
  console.log(JSON.stringify({
    configuredMode: env.databaseMode,
    detectedProvider: provider,
    host: url.hostname,
    database: row?.database_name ?? url.pathname.replace(/^\//,''),
    serverAddress: row?.server_addr ?? null,
    serverPort: row?.server_port ?? null,
    counts: {
      companies: Number(row?.companies ?? 0),
      candidates: Number(row?.candidates ?? 0),
      jobs: Number(row?.jobs ?? 0),
    },
  }, null, 2));
} finally {
  await closeDb();
}
