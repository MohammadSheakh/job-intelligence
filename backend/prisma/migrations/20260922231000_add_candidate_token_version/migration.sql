-- Add token_version column to candidate_auth for server-side session revocation
ALTER TABLE "candidate_auth" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 1;
