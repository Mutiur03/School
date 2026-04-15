-- AlterTable
ALTER TABLE "ssc_reg" ADD COLUMN     "classmates" TEXT,
ADD COLUMN     "classmates_source" TEXT NOT NULL DEFAULT 'default';
