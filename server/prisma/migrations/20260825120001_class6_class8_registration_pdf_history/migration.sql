ALTER TABLE "student_registration_class6"
ADD COLUMN "pdf_path" VARCHAR(255),
ADD COLUMN "pdf_settings_snapshot" JSONB,
ADD COLUMN "pdf_generated_at" TIMESTAMP(3);

ALTER TABLE "student_registration_class8"
ADD COLUMN "pdf_path" VARCHAR(255),
ADD COLUMN "pdf_settings_snapshot" JSONB,
ADD COLUMN "pdf_generated_at" TIMESTAMP(3);
