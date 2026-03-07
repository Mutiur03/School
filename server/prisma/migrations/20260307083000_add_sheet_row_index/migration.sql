-- AlterTable
ALTER TABLE "students" ADD COLUMN "sheet_row_index" INTEGER;

-- Syncing types from history (VARCHAR) to current DB (CHAR)
-- This avoids drift in future migrations
ALTER TABLE "students" ALTER COLUMN "batch" SET DATA TYPE CHAR(4);
ALTER TABLE "students" ALTER COLUMN "father_phone" SET DATA TYPE CHAR(11);
ALTER TABLE "students" ALTER COLUMN "mother_phone" SET DATA TYPE CHAR(11);
