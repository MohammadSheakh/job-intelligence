ALTER TABLE candidate_auth
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

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
