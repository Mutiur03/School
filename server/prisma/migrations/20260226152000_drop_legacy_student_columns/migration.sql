-- Remove old unique index that depends on legacy phone column
DROP INDEX IF EXISTS "students_login_id_phone_key";

-- Drop legacy student columns replaced by individual fields
ALTER TABLE "students"
DROP COLUMN IF EXISTS "phone",
DROP COLUMN IF EXISTS "parent_phone",
DROP COLUMN IF EXISTS "address",
DROP COLUMN IF EXISTS "blood_group";

-- Ensure login_id remains unique
CREATE UNIQUE INDEX IF NOT EXISTS "students_login_id_key" ON "students"("login_id");
