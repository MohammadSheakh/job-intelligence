import { db } from '../db.js';

export interface DashboardStats {
  companies: number;
  monitorReady: number;
  jobs: number;
  openJobs: number;
  candidates: number;
  notifications: number;
  crawlLogs: number;
  crawlFailures24h: number;
}

export interface RecentCrawlLog {
  id: number;
  companyId: string;
  companyName: string;
  checkedAt: Date;
  success: boolean;
  jobsFound: number;
  error: string | null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const result = await db.query<{
    companies: string;
    monitor_ready: string;
    jobs: string;
    open_jobs: string;
    candidates: string;
    notifications: string;
    crawl_logs: string;
    crawl_failures_24h: string;
  }>(`
    SELECT
      (SELECT count(*) FROM companies) AS companies,
      (SELECT count(*) FROM companies WHERE active = true AND career_url IS NOT NULL AND btrim(career_url) <> '' AND recommended_action = 'MONITOR_READY') AS monitor_ready,
      (SELECT count(*) FROM jobs) AS jobs,
      (SELECT count(*) FROM jobs WHERE status = 'OPEN') AS open_jobs,
      (SELECT count(*) FROM candidates WHERE active = true) AS candidates,
      (SELECT count(*) FROM notifications) AS notifications,
      (SELECT count(*) FROM crawl_logs) AS crawl_logs,
      (SELECT count(*) FROM crawl_logs WHERE success = false AND checked_at >= now() - interval '24 hours') AS crawl_failures_24h
  `);
  const row = result.rows[0];
  return {
    companies: Number(row.companies),
    monitorReady: Number(row.monitor_ready),
    jobs: Number(row.jobs),
    openJobs: Number(row.open_jobs),
    candidates: Number(row.candidates),
    notifications: Number(row.notifications),
    crawlLogs: Number(row.crawl_logs),
    crawlFailures24h: Number(row.crawl_failures_24h),
  };
}

export async function getRecentCrawlLogs(limit = 10): Promise<RecentCrawlLog[]> {
  const result = await db.query<{
    id: string | number;
    company_id: string;
    company_name: string;
    checked_at: Date;
    success: boolean;
    jobs_found: number;
    error: string | null;
  }>(
    `
    SELECT l.id, l.company_id, c.name AS company_name, l.checked_at, l.success, l.jobs_found, l.error
    FROM crawl_logs l
    JOIN companies c ON c.id = l.company_id
    ORDER BY l.checked_at DESC, l.id DESC
    LIMIT $1
  `,
    [limit],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    companyId: row.company_id,
    companyName: row.company_name,
    checkedAt: row.checked_at,
    success: row.success,
    jobsFound: row.jobs_found,
    error: row.error,
  }));
}

export interface CompanyAdminRow {
  id: string;
  name: string;
  websiteUrl: string | null;
  careerUrl: string | null;
  linkedinUrl: string | null;
  email: string | null;
  location: string | null;
  techStack: string | null;
  active: boolean;
  recommendedAction: string | null;
  needsManualReview: boolean;
  lastCheckedAt: Date | null;
  categories: string[];
}

export interface CompanyListResult {
  rows: CompanyAdminRow[];
  total: number;
}

export async function listCompanies(input: {
  search?: string;
  action?: string;
  category?: string;
  page: number;
  pageSize: number;
}): Promise<CompanyListResult> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (input.search?.trim()) {
    params.push(`%${input.search.trim()}%`);
    where.push(
      `(c.name ILIKE $${params.length} OR COALESCE(c.website_url, '') ILIKE $${params.length} OR COALESCE(c.location, '') ILIKE $${params.length})`,
    );
  }
  if (input.action?.trim()) {
    params.push(input.action.trim());
    where.push(`c.recommended_action = $${params.length}`);
  }
  if (input.category?.trim()) {
    params.push(input.category.trim());
    where.push(
      `EXISTS (SELECT 1 FROM company_categories cc JOIN categories cat ON cat.id = cc.category_id WHERE cc.company_id = c.id AND cat.name = $${params.length})`,
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await db.query<{ count: string }>(
    `SELECT count(*) FROM companies c ${whereSql}`,
    params,
  );

  params.push(input.pageSize);
  const limitRef = `$${params.length}`;
  params.push((input.page - 1) * input.pageSize);
  const offsetRef = `$${params.length}`;

  const result = await db.query<{
    id: string;
    name: string;
    website_url: string | null;
    career_url: string | null;
    linkedin_url: string | null;
    email: string | null;
    location: string | null;
    tech_stack: string | null;
    active: boolean;
    recommended_action: string | null;
    needs_manual_review: boolean;
    last_checked_at: Date | null;
    categories: string[] | null;
  }>(
    `
    SELECT c.id, c.name, c.website_url, c.career_url, c.linkedin_url, c.email,
           c.location, c.tech_stack, c.active, c.recommended_action,
           c.needs_manual_review, c.last_checked_at,
           ARRAY(SELECT cat.name FROM company_categories cc JOIN categories cat ON cat.id = cc.category_id WHERE cc.company_id = c.id ORDER BY cat.type, cat.name) AS categories
    FROM companies c
    ${whereSql}
    ORDER BY c.name ASC
    LIMIT ${limitRef} OFFSET ${offsetRef}
  `,
    params,
  );

  return {
    total: Number(countResult.rows[0].count),
    rows: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      websiteUrl: row.website_url,
      careerUrl: row.career_url,
      linkedinUrl: row.linkedin_url,
      email: row.email,
      location: row.location,
      techStack: row.tech_stack,
      active: row.active,
      recommendedAction: row.recommended_action,
      needsManualReview: row.needs_manual_review,
      lastCheckedAt: row.last_checked_at,
      categories: (() => {
        const cats = row.categories ?? [];
        return cats.length > 1 ? cats.filter((name) => name !== 'Other') : cats;
      })(),
    })),
  };
}

export interface CompanyEditRow extends CompanyAdminRow {
  notes: string | null;
  statusResearchHint: string | null;
}

export async function getCompanyById(id: string): Promise<CompanyEditRow | null> {
  const result = await db.query<{
    id: string;
    name: string;
    website_url: string | null;
    career_url: string | null;
    linkedin_url: string | null;
    email: string | null;
    location: string | null;
    tech_stack: string | null;
    notes: string | null;
    active: boolean;
    recommended_action: string | null;
    needs_manual_review: boolean;
    last_checked_at: Date | null;
    status_research_hint: string | null;
    categories: string[] | null;
  }>(
    `
    SELECT c.id, c.name, c.website_url, c.career_url, c.linkedin_url, c.email, c.location,
           c.tech_stack, c.notes, c.active, c.recommended_action, c.needs_manual_review, c.last_checked_at, c.status_research_hint,
           ARRAY(SELECT cat.name FROM company_categories cc JOIN categories cat ON cat.id = cc.category_id WHERE cc.company_id = c.id ORDER BY cat.type, cat.name) AS categories
    FROM companies c WHERE c.id = $1
  `,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    websiteUrl: row.website_url,
    careerUrl: row.career_url,
    linkedinUrl: row.linkedin_url,
    email: row.email,
    location: row.location,
    techStack: row.tech_stack,
    notes: row.notes,
    active: row.active,
    recommendedAction: row.recommended_action,
    needsManualReview: row.needs_manual_review,
    lastCheckedAt: row.last_checked_at,
    categories: (() => {
      const cats = row.categories ?? [];
      return cats.length > 1 ? cats.filter((name) => name !== 'Other') : cats;
    })(),
    statusResearchHint: row.status_research_hint,
  };
}

export interface CategoryAdminRow {
  id: number;
  name: string;
  type: 'technology' | 'domain' | 'sector' | 'other';
  companyCount: number;
}

export async function listCategories(): Promise<CategoryAdminRow[]> {
  const result = await db.query<{
    id: string | number;
    name: string;
    type: 'technology' | 'domain' | 'sector' | 'other';
    company_count: string;
  }>(`
    SELECT cat.id, cat.name, cat.type,
      CASE WHEN cat.name = 'Other' THEN (
        SELECT count(*)::text FROM companies c
        WHERE EXISTS (
          SELECT 1 FROM company_categories cc2 JOIN categories c2 ON c2.id=cc2.category_id
          WHERE cc2.company_id=c.id AND c2.name='Other'
        ) AND NOT EXISTS (
          SELECT 1 FROM company_categories cc3 JOIN categories c3 ON c3.id=cc3.category_id
          WHERE cc3.company_id=c.id AND c3.name<>'Other'
        )
      ) ELSE count(cc.company_id)::text END AS company_count
    FROM categories cat LEFT JOIN company_categories cc ON cc.category_id = cat.id
    GROUP BY cat.id, cat.name, cat.type
    ORDER BY CASE cat.type WHEN 'technology' THEN 1 WHEN 'domain' THEN 2 WHEN 'sector' THEN 3 ELSE 4 END, cat.name
  `);
  return result.rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    type: r.type,
    companyCount: Number(r.company_count),
  }));
}

export async function createCategory(
  name: string,
  type: 'technology' | 'domain' | 'sector' | 'other',
): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  await db.query(
    `INSERT INTO categories(name,type) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET type=EXCLUDED.type`,
    [clean, type],
  );
}

export async function replaceCompanyCategories(
  companyId: string,
  categoryNames: string[],
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM company_categories WHERE company_id = $1', [companyId]);
    const names = categoryNames.length ? categoryNames : ['Other'];
    await client.query(
      `
      INSERT INTO company_categories(company_id, category_id, source)
      SELECT $1, id, 'admin' FROM categories WHERE name = ANY($2::text[])
      ON CONFLICT (company_id, category_id) DO UPDATE SET source = 'admin'
    `,
      [companyId, names],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function updateCompany(input: {
  id: string;
  name: string;
  websiteUrl?: string;
  careerUrl?: string;
  linkedinUrl?: string;
  email?: string;
  location?: string;
  techStack?: string;
  notes?: string;
  recommendedAction?: string;
  statusResearchHint?: string;
  active: boolean;
}): Promise<void> {
  await db.query(
    `
    UPDATE companies SET
      name = $2,
      website_url = NULLIF($3, ''),
      career_url = NULLIF($4, ''),
      linkedin_url = NULLIF($5, ''),
      email = NULLIF($6, ''),
      location = NULLIF($7, ''),
      tech_stack = NULLIF($8, ''),
      notes = NULLIF($9, ''),
      recommended_action = NULLIF($10, ''),
      status_research_hint = NULLIF($11, ''),
      active = $12,
      updated_at = now()
    WHERE id = $1
  `,
    [
      input.id,
      input.name.trim(),
      input.websiteUrl?.trim() ?? '',
      input.careerUrl?.trim() ?? '',
      input.linkedinUrl?.trim() ?? '',
      input.email?.trim() ?? '',
      input.location?.trim() ?? '',
      input.techStack?.trim() ?? '',
      input.notes?.trim() ?? '',
      input.recommendedAction?.trim() ?? '',
      input.statusResearchHint?.trim() ?? '',
      input.active,
    ],
  );
}

export interface JobAdminRow {
  id: number;
  companyName: string;
  companyCategories: string[];
  title: string;
  location: string | null;
  workMode: string | null;
  skills: string | null;
  experience: string | null;
  applicationUrl: string | null;
  status: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export async function listJobs(input: {
  search?: string;
  status?: string;
  page: number;
  pageSize: number;
}): Promise<{ rows: JobAdminRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (input.search?.trim()) {
    params.push(`%${input.search.trim()}%`);
    where.push(
      `(j.title ILIKE $${params.length} OR c.name ILIKE $${params.length} OR COALESCE(j.location, '') ILIKE $${params.length})`,
    );
  }
  if (input.status?.trim()) {
    params.push(input.status.trim());
    where.push(`j.status = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await db.query<{ count: string }>(
    `
    SELECT count(*) FROM jobs j JOIN companies c ON c.id = j.company_id ${whereSql}
  `,
    params,
  );
  params.push(input.pageSize);
  const limitRef = `$${params.length}`;
  params.push((input.page - 1) * input.pageSize);
  const offsetRef = `$${params.length}`;
  const result = await db.query<{
    id: string | number;
    company_name: string;
    company_categories: string[] | null;
    title: string;
    location: string | null;
    work_mode: string | null;
    skills: string | null;
    experience: string | null;
    application_url: string | null;
    status: string;
    first_seen_at: Date;
    last_seen_at: Date;
  }>(
    `
    SELECT j.id, c.name AS company_name,
           COALESCE((
             SELECT array_agg(cat.name ORDER BY cat.name)
             FROM company_categories cc
             JOIN categories cat ON cat.id = cc.category_id
             WHERE cc.company_id = c.id AND cat.name <> 'Other'
           ), ARRAY[]::text[]) AS company_categories,
           j.title, j.location, j.work_mode, j.skills,
           j.experience, j.application_url, j.status, j.first_seen_at, j.last_seen_at
    FROM jobs j JOIN companies c ON c.id = j.company_id
    ${whereSql}
    ORDER BY j.first_seen_at DESC, j.id DESC
    LIMIT ${limitRef} OFFSET ${offsetRef}
  `,
    params,
  );
  return {
    total: Number(countResult.rows[0].count),
    rows: result.rows.map((row) => ({
      id: Number(row.id),
      companyName: row.company_name,
      companyCategories: row.company_categories ?? [],
      title: row.title,
      location: row.location,
      workMode: row.work_mode,
      skills: row.skills,
      experience: row.experience,
      applicationUrl: row.application_url,
      status: row.status,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
    })),
  };
}

export interface CandidateAdminRow {
  id: number;
  name: string;
  email: string;
  expertise: string | null;
  skills: string | null;
  experienceLevel: string | null;
  preferredLocations: string | null;
  excludedLocations: string | null;
  preferredWorkModes: string | null;
  preferredCategories: string | null;
  excludedCategories: string | null;
  minimumMatchScore: number;
  active: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
}

export async function listCandidates(): Promise<CandidateAdminRow[]> {
  const result = await db.query<{
    id: string | number;
    name: string;
    email: string;
    expertise: string | null;
    skills: string | null;
    experience_level: string | null;
    preferred_locations: string | null;
    excluded_locations: string | null;
    preferred_work_modes: string | null;
    preferred_categories: string | null;
    excluded_categories: string | null;
    minimum_match_score: number;
    active: boolean;
    has_password: boolean;
    has_google: boolean;
  }>(`
    SELECT c.id, c.name, c.email, c.expertise, c.skills, c.experience_level, c.preferred_locations,
           c.excluded_locations, c.preferred_work_modes, c.preferred_categories, c.excluded_categories, c.minimum_match_score, c.active,
           (a.password_hash IS NOT NULL) AS has_password, (a.google_sub IS NOT NULL) AS has_google
    FROM candidates c LEFT JOIN candidate_auth a ON a.candidate_id=c.id
    ORDER BY c.active DESC, c.name ASC
  `);
  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    email: row.email,
    expertise: row.expertise,
    skills: row.skills,
    experienceLevel: row.experience_level,
    preferredLocations: row.preferred_locations,
    excludedLocations: row.excluded_locations,
    preferredWorkModes: row.preferred_work_modes,
    preferredCategories: row.preferred_categories,
    excludedCategories: row.excluded_categories,
    minimumMatchScore: row.minimum_match_score,
    active: row.active,
    hasPassword: row.has_password,
    hasGoogle: row.has_google,
  }));
}

export async function getCandidateById(id: number): Promise<CandidateAdminRow | null> {
  const rows = await listCandidates();
  return rows.find((row) => row.id === id) ?? null;
}

export async function saveCandidate(input: {
  id?: number;
  name: string;
  email: string;
  expertise?: string;
  skills?: string;
  experienceLevel?: string;
  preferredLocations?: string;
  excludedLocations?: string;
  preferredWorkModes?: string;
  preferredCategories?: string;
  excludedCategories?: string;
  minimumMatchScore: number;
  active: boolean;
}): Promise<number> {
  if (input.id) {
    const result = await db.query<{ id: string | number }>(
      `
      UPDATE candidates SET
        name = $2,
        email = $3,
        expertise = NULLIF($4, ''),
        skills = NULLIF($5, ''),
        experience_level = NULLIF($6, ''),
        preferred_locations = NULLIF($7, ''),
        excluded_locations = NULLIF($8, ''),
        preferred_work_modes = NULLIF($9, ''),
        preferred_categories = NULLIF($10, ''),
        excluded_categories = NULLIF($11, ''),
        minimum_match_score = $12,
        active = $13,
        updated_at = now()
      WHERE id = $1
      RETURNING id
    `,
      [
        input.id,
        input.name.trim(),
        input.email.toLowerCase().trim(),
        input.expertise?.trim() ?? '',
        input.skills?.trim() ?? '',
        input.experienceLevel?.trim() ?? '',
        input.preferredLocations?.trim() ?? '',
        input.excludedLocations?.trim() ?? '',
        input.preferredWorkModes?.trim() ?? '',
        input.preferredCategories?.trim() ?? '',
        input.excludedCategories?.trim() ?? '',
        input.minimumMatchScore,
        input.active,
      ],
    );
    if (!result.rows[0]) throw new Error('Candidate not found');
    return Number(result.rows[0].id);
  }

  const result = await db.query<{ id: string | number }>(
    `
    INSERT INTO candidates (
      name, email, expertise, skills, experience_level,
      preferred_locations, excluded_locations, preferred_work_modes,
      preferred_categories, excluded_categories, minimum_match_score, active, updated_at
    ) VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),$11,$12,now())
    RETURNING id
  `,
    [
      input.name.trim(),
      input.email.toLowerCase().trim(),
      input.expertise?.trim() ?? '',
      input.skills?.trim() ?? '',
      input.experienceLevel?.trim() ?? '',
      input.preferredLocations?.trim() ?? '',
      input.excludedLocations?.trim() ?? '',
      input.preferredWorkModes?.trim() ?? '',
      input.preferredCategories?.trim() ?? '',
      input.excludedCategories?.trim() ?? '',
      input.minimumMatchScore,
      input.active,
    ],
  );
  return Number(result.rows[0].id);
}

export async function listCrawlLogs(
  page: number,
  pageSize: number,
): Promise<{ rows: RecentCrawlLog[]; total: number }> {
  const countResult = await db.query<{ count: string }>('SELECT count(*) FROM crawl_logs');
  const result = await db.query<{
    id: string | number;
    company_id: string;
    company_name: string;
    checked_at: Date;
    success: boolean;
    jobs_found: number;
    error: string | null;
  }>(
    `
    SELECT l.id, l.company_id, c.name AS company_name, l.checked_at, l.success, l.jobs_found, l.error
    FROM crawl_logs l JOIN companies c ON c.id = l.company_id
    ORDER BY l.checked_at DESC, l.id DESC
    LIMIT $1 OFFSET $2
  `,
    [pageSize, (page - 1) * pageSize],
  );
  return {
    total: Number(countResult.rows[0].count),
    rows: result.rows.map((row) => ({
      id: Number(row.id),
      companyId: row.company_id,
      companyName: row.company_name,
      checkedAt: row.checked_at,
      success: row.success,
      jobsFound: row.jobs_found,
      error: row.error,
    })),
  };
}
