-- Initial schema for EMPTY databases. Existing data requires reviewed baseline adoption.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "candidates" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expertise" TEXT,
    "skills" TEXT,
    "experience_level" TEXT,
    "experience_years" INTEGER,
    "preferred_locations" TEXT,
    "excluded_locations" TEXT,
    "preferred_work_modes" TEXT,
    "minimum_match_score" INTEGER NOT NULL DEFAULT 70,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferred_categories" TEXT,
    "excluded_categories" TEXT,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_auth" (
    "candidate_id" BIGINT NOT NULL,
    "password_hash" TEXT,
    "google_sub" TEXT,
    "google_email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "candidate_auth_pkey" PRIMARY KEY ("candidate_id")
);

-- CreateTable
CREATE TABLE "candidate_company_state" (
    "candidate_id" BIGINT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_applied_at" DATE,
    "reapply_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_company_state_pkey" PRIMARY KEY ("candidate_id","company_id")
);

-- CreateTable
CREATE TABLE "candidate_search_runs" (
    "id" BIGSERIAL NOT NULL,
    "candidate_id" BIGINT NOT NULL,
    "mode" TEXT NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companies_checked" INTEGER NOT NULL DEFAULT 0,
    "jobs_found" INTEGER NOT NULL DEFAULT 0,
    "matches_found" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,

    CONSTRAINT "candidate_search_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_source" TEXT,
    "website_url" TEXT,
    "career_url" TEXT,
    "linkedin_url" TEXT,
    "email" TEXT,
    "location" TEXT,
    "tech_stack" TEXT,
    "employee_count_hint" DECIMAL,
    "aiub_total_hint" TEXT,
    "status_research_hint" TEXT,
    "notes" TEXT,
    "additional_websites" TEXT,
    "additional_career_urls" TEXT,
    "additional_linkedin_urls" TEXT,
    "additional_emails" TEXT,
    "corporate_domains" TEXT,
    "source_rows" TEXT,
    "source_row_count" INTEGER NOT NULL DEFAULT 1,
    "needs_manual_review" BOOLEAN NOT NULL DEFAULT false,
    "review_reasons" TEXT,
    "needs_enrichment" BOOLEAN NOT NULL DEFAULT false,
    "enrichment_reasons" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recommended_action" TEXT,
    "last_checked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_categories" (
    "company_id" TEXT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'inferred',

    CONSTRAINT "company_categories_pkey" PRIMARY KEY ("company_id","category_id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" BIGSERIAL NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "work_mode" TEXT,
    "skills" TEXT,
    "experience" TEXT,
    "application_url" TEXT,
    "application_deadline" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "job_hash" TEXT NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_logs" (
    "id" BIGSERIAL NOT NULL,
    "company_id" TEXT,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "jobs_found" INTEGER NOT NULL DEFAULT 0,
    "http_status" INTEGER,
    "duration_ms" INTEGER,
    "crawler_type" TEXT,
    "jobs_created" INTEGER,
    "jobs_updated" INTEGER,
    "action_taken" TEXT,
    "error" TEXT,

    CONSTRAINT "crawl_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "candidate_id" BIGINT NOT NULL,
    "job_id" BIGINT NOT NULL,
    "match_score" INTEGER,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_auth_google_sub_key" ON "candidate_auth"("google_sub");

-- CreateIndex
CREATE INDEX "candidate_company_state_company_idx" ON "candidate_company_state"("company_id");

-- CreateIndex
CREATE INDEX "candidate_company_state_status_idx" ON "candidate_company_state"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "candidate_search_runs_candidate_day_idx" ON "candidate_search_runs"("candidate_id", "requested_at");

-- CreateIndex
CREATE INDEX "companies_action_idx" ON "companies"("recommended_action");

-- CreateIndex
CREATE INDEX "companies_active_idx" ON "companies"("active");

-- CreateIndex
CREATE INDEX "companies_career_url_idx" ON "companies"("career_url") WHERE (career_url IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "company_categories_category_id_idx" ON "company_categories"("category_id");

-- CreateIndex
CREATE INDEX "company_categories_company_id_idx" ON "company_categories"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_job_hash_key" ON "jobs"("job_hash");

-- CreateIndex
CREATE INDEX "jobs_company_id_idx" ON "jobs"("company_id");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_candidate_id_job_id_key" ON "notifications"("candidate_id", "job_id");

-- AddForeignKey
ALTER TABLE "candidate_auth" ADD CONSTRAINT "candidate_auth_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "candidate_company_state" ADD CONSTRAINT "candidate_company_state_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "candidate_company_state" ADD CONSTRAINT "candidate_company_state_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "candidate_search_runs" ADD CONSTRAINT "candidate_search_runs_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "company_categories" ADD CONSTRAINT "company_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "company_categories" ADD CONSTRAINT "company_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "crawl_logs" ADD CONSTRAINT "crawl_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Database invariants inherited from the legacy SQL; not expressible in Prisma models.
ALTER TABLE "categories" ADD CONSTRAINT "categories_type_check" CHECK ("type" IN ('technology','domain','sector','other'));
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_status_check" CHECK ("status" IN ('OPEN','CLOSED'));
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_minimum_match_score_check" CHECK ("minimum_match_score" BETWEEN 0 AND 100);
ALTER TABLE "candidate_company_state" ADD CONSTRAINT "candidate_company_state_status_check" CHECK ("status" IN ('PLANNING','APPLIED','EXCLUDED'));
ALTER TABLE "candidate_company_state" ADD CONSTRAINT "candidate_company_state_reapply_count_check" CHECK ("reapply_count" >= 0);

COMMIT;
