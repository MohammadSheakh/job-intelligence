CREATE TABLE IF NOT EXISTS companies (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_source text,
  website_url text,
  career_url text,
  linkedin_url text,
  email text,
  location text,
  tech_stack text,
  employee_count_hint numeric,
  aiub_total_hint text,
  status_research_hint text,
  notes text,
  additional_websites text,
  additional_career_urls text,
  additional_linkedin_urls text,
  additional_emails text,
  corporate_domains text,
  source_rows text,
  source_row_count integer NOT NULL DEFAULT 1,
  needs_manual_review boolean NOT NULL DEFAULT false,
  review_reasons text,
  needs_enrichment boolean NOT NULL DEFAULT false,
  enrichment_reasons text,
  active boolean NOT NULL DEFAULT true,
  recommended_action text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companies_active_idx ON companies(active);
CREATE INDEX IF NOT EXISTS companies_career_url_idx ON companies(career_url) WHERE career_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS companies_action_idx ON companies(recommended_action);

CREATE TABLE IF NOT EXISTS jobs (
  id bigserial PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  work_mode text,
  skills text,
  experience text,
  application_url text,
  published_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  job_hash text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS jobs_company_id_idx ON jobs(company_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);

CREATE TABLE IF NOT EXISTS candidates (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  expertise text,
  skills text,
  experience_level text,
  preferred_locations text,
  excluded_locations text,
  preferred_work_modes text,
  preferred_categories text,
  excluded_categories text,
  minimum_match_score integer NOT NULL DEFAULT 70 CHECK (minimum_match_score BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id bigserial PRIMARY KEY,
  candidate_id bigint NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id bigint NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  match_score integer,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, job_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crawl_logs (
  id bigserial PRIMARY KEY,
  company_id text REFERENCES companies(id) ON DELETE SET NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL,
  jobs_found integer NOT NULL DEFAULT 0,
  error text
);

INSERT INTO settings(key, value) VALUES
  ('ai_enabled', 'false'),
  ('ai_provider', ''),
  ('ai_daily_limit', '0'),
  ('ai_matching_enabled', 'false'),
  ('ai_skill_extraction_enabled', 'false'),
  ('default_match_threshold', '70'),
  ('email_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
