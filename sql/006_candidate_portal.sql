CREATE TABLE IF NOT EXISTS candidate_auth (
  candidate_id bigint PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
  password_hash text,
  google_sub text UNIQUE,
  google_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

INSERT INTO categories(name, type) VALUES ('NestJS', 'technology')
ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type;
