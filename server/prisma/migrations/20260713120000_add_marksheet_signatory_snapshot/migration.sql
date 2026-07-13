-- AlterTable: pin the signatories used when a marksheet was generated so that,
-- once an exam's result_date has passed, a later staff reassignment no longer
-- regenerates/re-stamps the finalized sheet.
ALTER TABLE "marksheet_files"
    ADD COLUMN "snapshot_head_id" INTEGER,
    ADD COLUMN "snapshot_head_role" VARCHAR(50),
    ADD COLUMN "snapshot_teacher_id" INTEGER;

ALTER TABLE "marksheet_bundles"
    ADD COLUMN "snapshot_head_id" INTEGER,
    ADD COLUMN "snapshot_head_role" VARCHAR(50),
    ADD COLUMN "snapshot_teachers" JSONB;
