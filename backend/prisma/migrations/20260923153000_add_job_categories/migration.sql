-- CreateTable
CREATE TABLE "job_categories" (
    "job_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'inferred',

    CONSTRAINT "job_categories_pkey" PRIMARY KEY ("job_id","category_id")
);

-- CreateIndex
CREATE INDEX "job_categories_job_id_idx" ON "job_categories"("job_id");

-- CreateIndex
CREATE INDEX "job_categories_category_id_idx" ON "job_categories"("category_id");

-- AddForeignKey
ALTER TABLE "job_categories" ADD CONSTRAINT "job_categories_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "job_categories" ADD CONSTRAINT "job_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
