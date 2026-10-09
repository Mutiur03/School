-- certificates / certificate_revisions: replace the JSON `data` blob with one real column per field.

-- certificates
ALTER TABLE "certificates"
  ADD COLUMN "student_name_bn" VARCHAR(150),
  ADD COLUMN "student_name_en" VARCHAR(100),
  ADD COLUMN "father_name_bn" VARCHAR(150),
  ADD COLUMN "father_name_en" VARCHAR(100),
  ADD COLUMN "mother_name_bn" VARCHAR(150),
  ADD COLUMN "mother_name_en" VARCHAR(100),
  ADD COLUMN "gender" VARCHAR(6),
  ADD COLUMN "roll" VARCHAR(6),
  ADD COLUMN "registration_no" VARCHAR(10),
  ADD COLUMN "gpa" DECIMAL(3,2);

UPDATE "certificates" SET
  "student_name_bn" = "data"->>'student_name_bn',
  "student_name_en" = "data"->>'student_name_en',
  "father_name_bn" = "data"->>'father_name_bn',
  "father_name_en" = "data"->>'father_name_en',
  "mother_name_bn" = "data"->>'mother_name_bn',
  "mother_name_en" = "data"->>'mother_name_en',
  "gender" = "data"->>'gender',
  "roll" = "data"->>'roll',
  "registration_no" = "data"->>'registration_no',
  "gpa" = NULLIF("data"->>'gpa', '')::numeric;

ALTER TABLE "certificates"
  ALTER COLUMN "student_name_bn" SET NOT NULL,
  ALTER COLUMN "student_name_en" SET NOT NULL,
  ALTER COLUMN "father_name_bn" SET NOT NULL,
  ALTER COLUMN "father_name_en" SET NOT NULL,
  ALTER COLUMN "mother_name_bn" SET NOT NULL,
  ALTER COLUMN "mother_name_en" SET NOT NULL,
  ALTER COLUMN "dob" TYPE DATE USING "dob"::date,
  DROP COLUMN "data";

DROP INDEX IF EXISTS "certificates_school_id_idx";
CREATE INDEX "certificates_school_id_updated_at_idx" ON "certificates"("school_id", "updated_at");

-- certificate_revisions (full copy of the row as it was before the edit)
ALTER TABLE "certificate_revisions"
  ADD COLUMN "exam" VARCHAR(10),
  ADD COLUMN "passing_year" INTEGER,
  ADD COLUMN "student_name_bn" VARCHAR(150),
  ADD COLUMN "student_name_en" VARCHAR(100),
  ADD COLUMN "father_name_bn" VARCHAR(150),
  ADD COLUMN "father_name_en" VARCHAR(100),
  ADD COLUMN "mother_name_bn" VARCHAR(150),
  ADD COLUMN "mother_name_en" VARCHAR(100),
  ADD COLUMN "mobile" VARCHAR(11),
  ADD COLUMN "dob" DATE,
  ADD COLUMN "gender" VARCHAR(6),
  ADD COLUMN "roll" VARCHAR(6),
  ADD COLUMN "registration_no" VARCHAR(10),
  ADD COLUMN "gpa" DECIMAL(3,2);

UPDATE "certificate_revisions" SET
  "exam" = "data"->>'exam',
  "passing_year" = ("data"->>'passing_year')::int,
  "student_name_bn" = "data"->>'student_name_bn',
  "student_name_en" = "data"->>'student_name_en',
  "father_name_bn" = "data"->>'father_name_bn',
  "father_name_en" = "data"->>'father_name_en',
  "mother_name_bn" = "data"->>'mother_name_bn',
  "mother_name_en" = "data"->>'mother_name_en',
  "mobile" = "data"->>'mobile',
  "dob" = ("data"->>'dob')::date,
  "gender" = "data"->>'gender',
  "roll" = "data"->>'roll',
  "registration_no" = "data"->>'registration_no',
  "gpa" = NULLIF("data"->>'gpa', '')::numeric;

ALTER TABLE "certificate_revisions"
  ALTER COLUMN "exam" SET NOT NULL,
  ALTER COLUMN "passing_year" SET NOT NULL,
  ALTER COLUMN "student_name_bn" SET NOT NULL,
  ALTER COLUMN "student_name_en" SET NOT NULL,
  ALTER COLUMN "father_name_bn" SET NOT NULL,
  ALTER COLUMN "father_name_en" SET NOT NULL,
  ALTER COLUMN "mother_name_bn" SET NOT NULL,
  ALTER COLUMN "mother_name_en" SET NOT NULL,
  ALTER COLUMN "mobile" SET NOT NULL,
  ALTER COLUMN "dob" SET NOT NULL,
  DROP COLUMN "data",
  DROP COLUMN "source";
