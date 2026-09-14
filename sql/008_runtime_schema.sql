CREATE TABLE IF NOT EXISTS categories (
  id bigserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('technology','domain','sector','other'))
);

CREATE TABLE IF NOT EXISTS company_categories (
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id bigint NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'inferred',
  PRIMARY KEY (company_id, category_id)
);

CREATE INDEX IF NOT EXISTS company_categories_company_id_idx ON company_categories(company_id);
CREATE INDEX IF NOT EXISTS company_categories_category_id_idx ON company_categories(category_id);

CREATE TABLE IF NOT EXISTS candidate_auth (
  candidate_id bigint PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
  password_hash text,
  google_sub text UNIQUE,
  google_email text,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE candidate_auth
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS candidate_company_state (
  candidate_id bigint NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('PLANNING','APPLIED','EXCLUDED')),
  last_applied_at date,
  reapply_count integer NOT NULL DEFAULT 0 CHECK (reapply_count >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, company_id)
);

CREATE INDEX IF NOT EXISTS candidate_company_state_status_idx ON candidate_company_state(candidate_id, status);
CREATE INDEX IF NOT EXISTS candidate_company_state_company_idx ON candidate_company_state(company_id);

CREATE TABLE IF NOT EXISTS candidate_search_runs (
  id bigserial PRIMARY KEY,
  candidate_id bigint NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  mode text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  companies_checked integer NOT NULL DEFAULT 0,
  jobs_found integer NOT NULL DEFAULT 0,
  matches_found integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error text
);

CREATE INDEX IF NOT EXISTS candidate_search_runs_candidate_day_idx
  ON candidate_search_runs(candidate_id, requested_at);

INSERT INTO settings(key,value) VALUES
  ('quick_search_daily_limit','3'),
  ('quick_search_ai_daily_limit','1'),
  ('quick_search_company_limit','8')
ON CONFLICT(key) DO NOTHING;

INSERT INTO categories(name,type) VALUES
  ('NestJS','technology'),
  ('Logistics','sector'),
  ('AgriTech','sector'),
  ('Joomla','technology'),
  ('SaaS/Product','sector'),
  ('Identity/Biometrics','domain')
ON CONFLICT(name) DO UPDATE SET type=EXCLUDED.type;
