-- Student login IDs are derived from (class-6 year, section, roll), so two schools
-- naturally produce the same ID. Login lookups are already scoped by school_id, but the
-- global unique index made the second school's insert silently skip (createMany
-- skipDuplicates) and then crash with "Argument `student_id` is missing" (HTTP 500).
-- Make uniqueness per school instead. Non-destructive: every existing row already
-- satisfies the narrower (school_id, login_id) constraint.
-- Create the per-school index first so uniqueness is never unenforced between statements.
CREATE UNIQUE INDEX "students_school_id_login_id_key" ON "students"("school_id", "login_id");
DROP INDEX IF EXISTS "students_login_id_key";
