ALTER TABLE "student_registration_ssc"
ADD COLUMN "pdf_path" VARCHAR(255),
ADD COLUMN "pdf_settings_snapshot" JSONB,
ADD COLUMN "pdf_generated_at" TIMESTAMP(3);

DROP INDEX IF EXISTS "ssc_reg_school_id_key";
CREATE UNIQUE INDEX "ssc_reg_school_id_ssc_year_key" ON "ssc_reg"("school_id", "ssc_year");
