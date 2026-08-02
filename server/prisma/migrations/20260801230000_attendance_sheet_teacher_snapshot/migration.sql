-- Pin the class teacher used when a monthly attendance sheet was generated so
-- that, once the month has ended, a later class-teacher reassignment no longer
-- regenerates or re-stamps the finalized sheet (same idea as marksheet
-- signatory snapshots after result_date).
ALTER TABLE "attendance_sheets"
    ADD COLUMN "snapshot_teacher_id" INTEGER,
    ADD COLUMN "snapshot_teacher_name" VARCHAR(200);
