/*
  Warnings:

  - Changed the type of `login_id` on the `students` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- Alter column type safely
ALTER TABLE "students"
ALTER COLUMN "login_id" TYPE BIGINT USING "login_id"::BIGINT;

-- Recreate indexes (if needed)
CREATE UNIQUE INDEX IF NOT EXISTS "students_login_id_key" ON "students"("login_id");
CREATE INDEX IF NOT EXISTS "students_login_id_idx" ON "students"("login_id");