ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS preferred_categories text,
  ADD COLUMN IF NOT EXISTS excluded_categories text;
