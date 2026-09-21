import { db, closeDb } from '../src/db.js';

try {
  const counts = await db.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE career_url IS NOT NULL)::int AS with_career_url,
      count(*) FILTER (WHERE recommended_action = 'MONITOR_READY')::int AS monitor_ready,
      count(*) FILTER (WHERE needs_manual_review)::int AS manual_review,
      count(*) FILTER (WHERE active)::int AS active
    FROM companies
  `);
  const settings = await db.query('SELECT key, value FROM settings ORDER BY key');
  const sample = await db.query(`
    SELECT id, name, website_url, career_url, recommended_action
    FROM companies
    WHERE career_url IS NOT NULL
    ORDER BY id
    LIMIT 5
  `);
  console.log(
    JSON.stringify(
      { counts: counts.rows[0], settings: settings.rows, sample: sample.rows },
      null,
      2,
    ),
  );
} finally {
  await closeDb();
}
