-- Approval lock + birth registration / NID number (same pending/approved pattern as registration).
-- Existing rows stay locked (approved); new inserts default to pending.
-- birth_reg_no is NULL on existing rows: NULLs are distinct, so they never collide in the new unique key.

ALTER TABLE "certificates" ADD COLUMN "birth_reg_no" VARCHAR(17);
ALTER TABLE "certificates" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "certificates" ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE INDEX "certificates_school_id_status_idx" ON "certificates"("school_id", "status");

-- One certificate per batch + phone + class + birth reg/NID (also the public lookup key).
-- Name is Prisma's 63-char form: the full name exceeds Postgres's identifier limit.
DROP INDEX "certificates_school_id_passing_year_mobile_dob_exam_key";
CREATE UNIQUE INDEX "certificates_school_id_passing_year_mobile_exam_birth_reg_n_key" ON "certificates"("school_id", "passing_year", "mobile", "exam", "birth_reg_no");

ALTER TABLE "certificate_revisions" ADD COLUMN "birth_reg_no" VARCHAR(17);
