-- Class 8 registration: same Class Six fields as junior scholarship
-- (reg year / board / reg no / roll) instead of registration_no + session.
-- Junior scholarship: rename class6_passing_year → class6_reg_year.

ALTER TABLE "student_registration_class8"
  ADD COLUMN "class6_reg_year" VARCHAR(4) NOT NULL DEFAULT '',
  ADD COLUMN "class6_board" VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN "class6_reg_no" VARCHAR(10) NOT NULL DEFAULT '',
  ADD COLUMN "class6_roll_no" VARCHAR(20) NOT NULL DEFAULT '';

-- FORCE RLS would hide rows from the table owner; copy then restore.
ALTER TABLE "student_registration_class8" DISABLE ROW LEVEL SECURITY;

UPDATE "student_registration_class8"
SET
  "class6_reg_year" = LEFT(COALESCE("class6_academic_session", ''), 4),
  "class6_reg_no" = LEFT(COALESCE("registration_no", ''), 10);

ALTER TABLE "student_registration_class8" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_registration_class8" FORCE ROW LEVEL SECURITY;

ALTER TABLE "student_registration_class8"
  DROP COLUMN "registration_no",
  DROP COLUMN "class6_academic_session";

ALTER TABLE "student_registration_class8"
  ALTER COLUMN "class6_reg_year" DROP DEFAULT,
  ALTER COLUMN "class6_board" DROP DEFAULT,
  ALTER COLUMN "class6_reg_no" DROP DEFAULT,
  ALTER COLUMN "class6_roll_no" DROP DEFAULT;

ALTER TABLE "student_registration_junior_scholarship"
  RENAME COLUMN "class6_passing_year" TO "class6_reg_year";
