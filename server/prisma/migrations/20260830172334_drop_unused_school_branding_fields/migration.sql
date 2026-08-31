-- Drop unused School columns removed from product UI/API.
ALTER TABLE "School" DROP COLUMN IF EXISTS "favicon";
ALTER TABLE "School" DROP COLUMN IF EXISTS "government_logo";
ALTER TABLE "School" DROP COLUMN IF EXISTS "website";
ALTER TABLE "School" DROP COLUMN IF EXISTS "location";
