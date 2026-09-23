import 'dotenv/config';
import { db, closeDb } from '../src/db.js';
import { classifyJobCategories } from '../backend/src/features/job-crawling/domain/job-category-classifier.js';

async function backfill() {
  console.log('Fetching existing categories from database...');
  const catResult = await db.query<{ id: string; name: string }>('SELECT id, name FROM categories');
  const catMap = new Map<string, string>();
  for (const row of catResult.rows) {
    catMap.set(row.name.toLowerCase(), row.id);
  }
  console.log(`Loaded ${catMap.size} categories.`);

  console.log('Fetching all existing jobs...');
  const jobsResult = await db.query<{
    id: string;
    title: string;
    description: string | null;
    skills: string | null;
  }>('SELECT id, title, description, skills FROM jobs ORDER BY id ASC');
  console.log(`Found ${jobsResult.rows.length} jobs to classify.`);

  let classifiedJobs = 0;
  let totalLinksCreated = 0;

  for (const job of jobsResult.rows) {
    const classification = classifyJobCategories({
      title: job.title,
      description: job.description,
      skills: job.skills,
    });

    if (classification.categories.length === 0) continue;

    classifiedJobs++;
    for (const cat of classification.categories) {
      const catId = catMap.get(cat.name.toLowerCase());
      if (!catId) continue;

      await db.query(
        `INSERT INTO job_categories (job_id, category_id, source)
         VALUES ($1, $2, $3)
         ON CONFLICT (job_id, category_id) DO UPDATE SET source = EXCLUDED.source`,
        [job.id, catId, cat.source],
      );
      totalLinksCreated++;
    }

    if (!job.skills && classification.skills.length > 0) {
      await db.query('UPDATE jobs SET skills = $1 WHERE id = $2', [
        classification.skills.join(', '),
        job.id,
      ]);
    }
  }

  console.log('\n=== Backfill Summary ===');
  console.log(`Total Jobs: ${jobsResult.rows.length}`);
  console.log(`Jobs with Categories: ${classifiedJobs}`);
  console.log(`Job-Category Links Created/Updated: ${totalLinksCreated}`);

  await closeDb();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
