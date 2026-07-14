-- AlterTable
ALTER TABLE "marksheet_files" ADD COLUMN "snapshot_design_version" VARCHAR(32);

-- AlterTable
ALTER TABLE "marksheet_bundles" ADD COLUMN "snapshot_design_version" VARCHAR(32);
