-- Forward-only diagnostics extension. Review the target before applying.
-- Existing logs retain NULL: historical metrics cannot be reconstructed.
-- This does not establish a Prisma Migrate baseline.
BEGIN;
ALTER TABLE crawl_logs
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS crawler_type text,
  ADD COLUMN IF NOT EXISTS jobs_created integer,
  ADD COLUMN IF NOT EXISTS jobs_updated integer,
  ADD COLUMN IF NOT EXISTS action_taken text;
COMMIT;
