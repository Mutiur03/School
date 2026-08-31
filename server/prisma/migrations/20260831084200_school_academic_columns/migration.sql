-- Move academic enum fields from JSON to columns.
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "subject_groups" VARCHAR(100);
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "medium" VARCHAR(50);
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "board" VARCHAR(100);
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "ownership" VARCHAR(50);
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "gender" VARCHAR(50);

UPDATE "School"
SET
  "subject_groups" = COALESCE(NULLIF(TRIM("subject_groups"), ''), NULLIF(TRIM("academic_profile"->>'subjects'), '')),
  "medium" = COALESCE(NULLIF(TRIM("medium"), ''), NULLIF(TRIM("academic_profile"->>'medium'), '')),
  "board" = COALESCE(NULLIF(TRIM("board"), ''), NULLIF(TRIM("academic_profile"->>'board'), '')),
  "ownership" = COALESCE(NULLIF(TRIM("ownership"), ''), NULLIF(TRIM("academic_profile"->>'ownership'), '')),
  "gender" = COALESCE(NULLIF(TRIM("gender"), ''), NULLIF(TRIM("academic_profile"->>'gender'), ''))
WHERE "academic_profile" IS NOT NULL;

UPDATE "School"
SET "academic_profile" = "academic_profile" - 'subjects' - 'medium' - 'board' - 'ownership' - 'gender'
WHERE "academic_profile" IS NOT NULL;
