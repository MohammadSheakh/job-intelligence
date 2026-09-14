import { db } from '../db.js';
import type { CrawledJob } from '../crawler/types.js';
import { createJobHash, normalizeLocation, normalizeTitle } from '../jobs/normalize.js';

export interface UpsertJobResult {
  id: number;
  inserted: boolean;
  jobHash: string;
}

export async function upsertJob(job: CrawledJob): Promise<UpsertJobResult> {
  const jobHash = createJobHash(job);
  const title = normalizeTitle(job.title);
  const location = normalizeLocation(job.location) ?? null;

  const result = await db.query<{ id: number; inserted: boolean }>(`
    INSERT INTO jobs (
      company_id,
      title,
      description,
      location,
      application_url,
      first_seen_at,
      last_seen_at,
      status,
      job_hash
    ) VALUES ($1, $2, $3, $4, $5, now(), now(), 'OPEN', $6)
    ON CONFLICT (job_hash) DO UPDATE SET
      title = EXCLUDED.title,
      description = COALESCE(EXCLUDED.description, jobs.description),
      location = COALESCE(EXCLUDED.location, jobs.location),
      application_url = EXCLUDED.application_url,
      last_seen_at = now(),
      status = 'OPEN'
    RETURNING id, (xmax = 0) AS inserted
  `, [
    job.companyId,
    title,
    job.description ?? null,
    location,
    job.applicationUrl,
    jobHash,
  ]);

  return {
    id: Number(result.rows[0].id),
    inserted: result.rows[0].inserted,
    jobHash,
  };
}

export interface JobForMatchingRow {
  id: number;
  companyId: string;
  companyName: string;
  companyWebsiteUrl: string | null;
  companyCareerUrl: string | null;
  companyLocation: string | null;
  companyTechStack: string | null;
  companyCategories: string[];
  companySectorCategories: string[];
  title: string;
  description: string | null;
  location: string | null;
  workMode: string | null;
  skills: string | null;
  experience: string | null;
  applicationUrl: string | null;
  firstSeenAt: Date;
}

export async function getOpenJobsForMatching(): Promise<JobForMatchingRow[]> {
  const result = await db.query<{
    id: string | number;
    company_id: string;
    company_name: string;
    company_website_url: string | null;
    company_career_url: string | null;
    company_location: string | null;
    company_tech_stack: string | null;
    company_categories: string[] | null;
    company_sector_categories: string[] | null;
    title: string;
    description: string | null;
    location: string | null;
    work_mode: string | null;
    skills: string | null;
    experience: string | null;
    application_url: string | null;
    first_seen_at: Date;
  }>(`
    SELECT j.id, j.company_id,
           c.name AS company_name,
           c.website_url AS company_website_url,
           c.career_url AS company_career_url,
           c.location AS company_location,
           c.tech_stack AS company_tech_stack,
           COALESCE((
             SELECT array_agg(cat.name ORDER BY cat.name)
             FROM company_categories cc
             JOIN categories cat ON cat.id = cc.category_id
             WHERE cc.company_id = c.id
               AND cat.name <> 'Other'
           ), ARRAY[]::text[]) AS company_categories,
           COALESCE((
             SELECT array_agg(cat.name ORDER BY cat.name)
             FROM company_categories cc
             JOIN categories cat ON cat.id = cc.category_id
             WHERE cc.company_id = c.id
               AND cat.type = 'sector'
           ), ARRAY[]::text[]) AS company_sector_categories,
           j.title, j.description, j.location, j.work_mode, j.skills,
           j.experience, j.application_url, j.first_seen_at
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'OPEN'
    ORDER BY j.first_seen_at DESC, j.id DESC
  `);

  return result.rows.map((row) => ({
    id: Number(row.id),
    companyId: row.company_id,
    companyName: row.company_name,
    companyWebsiteUrl: row.company_website_url,
    companyCareerUrl: row.company_career_url,
    companyLocation: row.company_location,
    companyTechStack: row.company_tech_stack,
    companyCategories: row.company_categories ?? [],
    companySectorCategories: row.company_sector_categories ?? [],
    title: row.title,
    description: row.description,
    location: row.location,
    workMode: row.work_mode,
    skills: row.skills,
    experience: row.experience,
    applicationUrl: row.application_url,
    firstSeenAt: row.first_seen_at,
  }));
}
